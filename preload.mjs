import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lightFS", {
    /**
     * Save a light track to disk.
     * @param {string} name  file base name without extension
     * @param {object} data  JSON serialisable track data
     */
    saveTrack: (name, data) =>
        ipcRenderer.invoke("lightfs-save-track", name, data),
    /**
     * Load all existing tracks. Returns Array<{name, data}>
     */
    loadTracks: () => ipcRenderer.invoke("lightfs-load-tracks"),
    /**
     * Delete a given track file
     */
    deleteTrack: (name) => ipcRenderer.invoke("lightfs-delete-track", name),
});
