const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lightFS", {
    saveTrack: (name, data) =>
        ipcRenderer.invoke("lightfs-save-track", name, data),
    loadTracks: () => ipcRenderer.invoke("lightfs-load-tracks"),
    deleteTrack: (name) => ipcRenderer.invoke("lightfs-delete-track", name),
});
