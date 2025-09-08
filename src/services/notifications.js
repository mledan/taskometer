export const notifications = {
  requestPermission: async () => {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }
    
    const permission = await Notification.requestPermission();
    return permission === "granted";
  },

  showNotification: (title, options = {}) => {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, options);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, options);
        }
      });
    }
  }
};

export default notifications;
