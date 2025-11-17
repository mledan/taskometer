import { useState, useEffect } from 'react';
import { useAppState, useAppReducer } from '../AppContext.jsx';
import { toLocalTime, formatLocalTime } from '../utils/timeDisplay.js';
import config, { isGoogleConfigured, validateEnvironment } from '../config/environment.js';
import styles from './CalendarSync.module.css';
import { format } from 'date-fns';

function CalendarSync() {
  const { items } = useAppState();
  const dispatch = useAppReducer();
  const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
  const [isAppleConnected, setIsAppleConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Google Calendar Integration
  const [gapiInited, setGapiInited] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    // Load Google API
    const loadGoogleAPI = async () => {
      if (typeof gapi === 'undefined' || typeof google === 'undefined') {
        console.log('Google API not loaded. Add script tags to index.html');
        return;
      }

      // Check if Google is properly configured
      if (!isGoogleConfigured()) {
        console.warn('Google Calendar API not configured. Please set up environment variables.');
        return;
      }

      // Initialize GAPI client
      try {
        await gapi.load('client', async () => {
          await gapi.client.init({
            apiKey: config.google.apiKey,
            discoveryDocs: [config.google.discoveryDoc],
          });
          setGapiInited(true);
        });

        // Initialize token client
        const client = google.accounts.oauth2.initTokenClient({
          client_id: config.google.clientId,
          scope: config.google.scopes,
          callback: handleGoogleAuthCallback,
        });
        setTokenClient(client);

        // Check if already authorized
        const token = localStorage.getItem('google_access_token');
        if (token) {
          gapi.client.setToken({ access_token: token });
          setIsGoogleAuthorized(true);
        }
      } catch (error) {
        console.error('Failed to initialize Google API:', error);
      }
    };

    loadGoogleAPI();
  }, []);

  const handleGoogleAuthCallback = (response) => {
    if (response.error) {
      console.error('Google Auth Error:', response.error);
      setSyncStatus('Authorization failed');
      return;
    }

    // Store token
    localStorage.setItem('google_access_token', response.access_token);
    setIsGoogleAuthorized(true);
    setSyncStatus('Google Calendar connected successfully!');
    
    // Auto-sync after auth
    syncWithGoogle();
  };

  const connectGoogleCalendar = () => {
    if (!tokenClient) {
      setSyncStatus('Google API not initialized');
      return;
    }

    if (isGoogleAuthorized) {
      syncWithGoogle();
    } else {
      // Request authorization
      tokenClient.requestAccessToken();
    }
  };

  const disconnectGoogleCalendar = () => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken(null);
    }
    localStorage.removeItem('google_access_token');
    setIsGoogleAuthorized(false);
    setSyncStatus('Disconnected from Google Calendar');
  };

  const syncWithGoogle = async () => {
    if (!isGoogleAuthorized || !gapiInited) {
      setSyncStatus('Not authorized');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Syncing with Google Calendar...');

    try {
      // Get scheduled tasks
      const scheduledTasks = items.filter(item => 
        item.scheduledTime && item.status !== 'completed'
      );

      // Export tasks to Google Calendar
      for (const task of scheduledTasks) {
        await exportTaskToGoogle(task);
      }

      // Import events from Google Calendar
      await importFromGoogle();

      setSyncStatus(`Synced ${scheduledTasks.length} tasks successfully!`);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const exportTaskToGoogle = async (task) => {
    const startTime = toLocalTime(task.scheduledTime);
    const endTime = new Date(startTime.getTime() + (task.duration || 30) * 60000);

    const event = {
      summary: task.text,
      description: `Task Type: ${task.taskType}\nPriority: ${task.priority}\nCreated with Taskometer`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: getGoogleColorId(task.priority),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      console.log('Event created:', response.result);
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const importFromGoogle = async () => {
    try {
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.result.items;
      console.log('Imported events from Google:', events.length);

      // Convert Google Calendar events to tasks
      let importedCount = 0;
      events.forEach(event => {
        // Skip if event doesn't have a start time
        if (!event.start || !event.start.dateTime) return;

        // Check if we already have this event (avoid duplicates)
        const existingTask = items.find(item =>
          item.googleEventId === event.id ||
          (item.text === event.summary && item.scheduledTime === event.start.dateTime)
        );

        if (existingTask) {
          console.log('Skipping duplicate event:', event.summary);
          return;
        }

        const task = convertGoogleEventToTask(event);
        dispatch({ type: 'ADD_ITEM', item: task });
        importedCount++;
      });

      console.log(`Imported ${importedCount} new events from Google Calendar`);
      return importedCount;
    } catch (error) {
      console.error('Failed to import events:', error);
      throw error;
    }
  };

  const convertGoogleEventToTask = (event) => {
    const startTime = new Date(event.start.dateTime || event.start.date);
    const endTime = new Date(event.end.dateTime || event.end.date);
    const duration = Math.round((endTime - startTime) / 60000); // minutes

    // Try to extract task type from description
    let taskType = 'work';
    if (event.description) {
      const typeMatch = event.description.match(/Task Type:\s*(\w+)/i);
      if (typeMatch) {
        taskType = typeMatch[1];
      }
    }

    // Try to extract priority from description
    let priority = 'medium';
    if (event.description) {
      const priorityMatch = event.description.match(/Priority:\s*(\w+)/i);
      if (priorityMatch) {
        priority = priorityMatch[1];
      }
    }

    return {
      key: `google-${event.id}-${Date.now()}`,
      text: event.summary || 'Untitled Event',
      description: event.description || '',
      status: 'pending',
      taskType,
      priority,
      duration,
      scheduledTime: startTime.toISOString(),
      specificTime: startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      scheduledFor: startTime.toISOString().split('T')[0],
      specificDay: format(startTime, 'EEEE'),
      googleEventId: event.id,
      importedFrom: 'google',
      importedAt: new Date().toISOString()
    };
  };

  const getGoogleColorId = (priority) => {
    // Google Calendar color IDs
    const colorMap = {
      high: '11', // Red
      medium: '5', // Yellow
      low: '2', // Green
    };
    return colorMap[priority] || '1';
  };

  // Apple Calendar Integration (ICS Export/Import)
  const generateICSFile = () => {
    const scheduledTasks = items.filter(item => 
      item.scheduledTime && item.status !== 'completed'
    );

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Taskometer//Task Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    scheduledTasks.forEach(task => {
      const startTime = toLocalTime(task.scheduledTime);
      const endTime = new Date(startTime.getTime() + (task.duration || 30) * 60000);
      
      const formatDateForICS = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };

      icsContent = icsContent.concat([
        'BEGIN:VEVENT',
        `UID:${task.key}@taskometer.local`,
        `DTSTART:${formatDateForICS(startTime)}`,
        `DTEND:${formatDateForICS(endTime)}`,
        `SUMMARY:${task.text}`,
        `DESCRIPTION:Type: ${task.taskType}\\nPriority: ${task.priority}`,
        `CATEGORIES:${task.taskType}`,
        `PRIORITY:${task.priority === 'high' ? 1 : task.priority === 'medium' ? 5 : 9}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ]);
    });

    icsContent.push('END:VCALENDAR');
    
    return icsContent.join('\r\n');
  };

  const exportToAppleCalendar = () => {
    const icsContent = generateICSFile();
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskometer-calendar-${new Date().toISOString().split('T')[0]}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus('Calendar file downloaded. Import it to Apple Calendar.');
  };

  const importFromICSFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseICSContent(content);
    };
    reader.readAsText(file);
  };

  const parseICSContent = (content) => {
    // Basic ICS parser
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;

    lines.forEach(line => {
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent) {
          events.push(currentEvent);
          currentEvent = null;
        }
      } else if (currentEvent) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':');
        
        switch (key) {
          case 'SUMMARY':
            currentEvent.summary = value;
            break;
          case 'DTSTART':
            currentEvent.start = parseICSDate(value);
            break;
          case 'DTEND':
            currentEvent.end = parseICSDate(value);
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\n/g, '\n');
            break;
        }
      }
    });

    console.log('Parsed events:', events);

    // Convert ICS events to tasks and add them to the app
    let importedCount = 0;
    events.forEach(event => {
      // Skip if event doesn't have required fields
      if (!event.summary || !event.start) return;

      // Check if we already have this event (avoid duplicates)
      const existingTask = items.find(item =>
        item.text === event.summary &&
        item.scheduledTime === event.start.toISOString()
      );

      if (existingTask) {
        console.log('Skipping duplicate event:', event.summary);
        return;
      }

      const task = convertICSEventToTask(event);
      dispatch({ type: 'ADD_ITEM', item: task });
      importedCount++;
    });

    setSyncStatus(`Imported ${importedCount} new events from ICS file`);
  };

  const convertICSEventToTask = (event) => {
    const startTime = event.start;
    const endTime = event.end || new Date(startTime.getTime() + 30 * 60000);
    const duration = Math.round((endTime - startTime) / 60000); // minutes

    // Try to extract task type from description
    let taskType = 'work';
    if (event.description) {
      const typeMatch = event.description.match(/Type:\s*(\w+)/i);
      if (typeMatch) {
        taskType = typeMatch[1];
      }
    }

    // Try to extract priority from description
    let priority = 'medium';
    if (event.description) {
      const priorityMatch = event.description.match(/Priority:\s*(\w+)/i);
      if (priorityMatch) {
        priority = priorityMatch[1];
      }
    }

    return {
      key: `ics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: event.summary,
      description: event.description || '',
      status: 'pending',
      taskType,
      priority,
      duration,
      scheduledTime: startTime.toISOString(),
      specificTime: startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      scheduledFor: startTime.toISOString().split('T')[0],
      specificDay: format(startTime, 'EEEE'),
      importedFrom: 'ics',
      importedAt: new Date().toISOString()
    };
  };

  const parseICSDate = (dateString) => {
    // Basic ICS date parser (YYYYMMDDTHHMMSSZ format)
    const year = dateString.substr(0, 4);
    const month = dateString.substr(4, 2);
    const day = dateString.substr(6, 2);
    const hour = dateString.substr(9, 2);
    const minute = dateString.substr(11, 2);
    const second = dateString.substr(13, 2);
    
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  };

  // Universal "Add to Calendar" functionality
  const generateCalendarLinks = (task) => {
    const startTime = toLocalTime(task.scheduledTime);
    const endTime = new Date(startTime.getTime() + (task.duration || 30) * 60000);
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.text)}&dates=${formatGoogleDate(startTime)}/${formatGoogleDate(endTime)}&details=${encodeURIComponent(`Type: ${task.taskType}\nPriority: ${task.priority}`)}`;
    
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(task.text)}&startdt=${startTime.toISOString()}&enddt=${endTime.toISOString()}&body=${encodeURIComponent(`Type: ${task.taskType}\nPriority: ${task.priority}`)}`;
    
    return { googleUrl, outlookUrl };
  };

  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  return (
    <>
      <button 
        className={styles.syncButton}
        onClick={() => setShowModal(true)}
        title="Calendar Sync"
      >
        📅 Sync
      </button>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Calendar Sync</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.providers}>
              {/* Google Calendar */}
              <div className={styles.provider}>
                <h3>🔷 Google Calendar</h3>
                <p>Two-way sync with your Google Calendar</p>
                {!isGoogleAuthorized ? (
                  <button 
                    className={styles.connectButton}
                    onClick={connectGoogleCalendar}
                    disabled={!gapiInited}
                  >
                    Connect Google Calendar
                  </button>
                ) : (
                  <div className={styles.connectedActions}>
                    <button 
                      className={styles.syncNowButton}
                      onClick={syncWithGoogle}
                      disabled={isSyncing}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button 
                      className={styles.disconnectButton}
                      onClick={disconnectGoogleCalendar}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              {/* Apple Calendar */}
              <div className={styles.provider}>
                <h3>🍎 Apple Calendar</h3>
                <p>Export/Import via ICS files</p>
                <div className={styles.appleActions}>
                  <button 
                    className={styles.exportButton}
                    onClick={exportToAppleCalendar}
                  >
                    Export to .ics
                  </button>
                  <label className={styles.importButton}>
                    Import .ics
                    <input 
                      type="file"
                      accept=".ics"
                      onChange={importFromICSFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Universal Add to Calendar */}
              <div className={styles.provider}>
                <h3>📆 Quick Add</h3>
                <p>Add individual tasks to any calendar</p>
                <div className={styles.info}>
                  Available in task context menu
                </div>
              </div>
            </div>

            {syncStatus && (
              <div className={styles.status}>
                {syncStatus}
              </div>
            )}

            <div className={styles.privacy}>
              <span className={styles.lock}>🔒</span>
              Your calendar data stays private. Tokens are stored locally.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CalendarSync;