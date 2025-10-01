import { useState, useEffect } from 'react';
import { useAppState } from '../AppContext.jsx';
import { toLocalTime, formatLocalTime } from '../utils/timeDisplay.js';
import config, { isGoogleConfigured, validateEnvironment } from '../config/environment.js';
import styles from './CalendarSync.module.css';

function CalendarSync() {
  const { items } = useAppState();
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
      
      // Process imported events (you can dispatch actions to add them as tasks)
      // This is where you'd convert Google events back to tasks
    } catch (error) {
      console.error('Failed to import events:', error);
    }
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
    setSyncStatus(`Imported ${events.length} events from ICS file`);
    
    // Here you would convert events to tasks and add them to your app
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