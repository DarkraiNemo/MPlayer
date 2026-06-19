document.getElementById('year').textContent = new Date().getFullYear();

function showTab(name) {
    const tabs = document.querySelectorAll('main section');
    tabs.forEach(tab => tab.style.display = 'none');

    const target = document.getElementById('tab-' + name);
    if (!target) return;

    target.style.display = 'flex';
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = '';
}

document.addEventListener("DOMContentLoaded", () => {
    showTab('welcome');
});

window.addEventListener("load", () => {
    hideLoadingScreen();
});

function hideLoadingScreen() {
    document.getElementById("loading-screen").classList.add("hidden");
}

async function handleDroppedFiles(itemsOrFiles) {
    let droppedFiles = [];

    if (itemsOrFiles instanceof DataTransferItemList) {
        droppedFiles = await readDroppedItems(itemsOrFiles);
    } else {
        droppedFiles = [...itemsOrFiles];
    }

    const audioFiles = droppedFiles.filter(isAudioFile);

    if (audioFiles.length === 0) return;

    playlist = audioFiles;
    renderPlaylist();
    showTab('playlist');
    loadTrack(0);
}

async function readDroppedItems(items) {
    const files = [];

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();

        if (entry?.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            files.push(file);
        } else if (entry?.isDirectory) {
            files.push(...await readDirectory(entry));
        } else {
            const file = item.getAsFile?.();
            if (file) files.push(file);
        }
    }

    return files;
}

async function readDirectory(dirEntry) {
    const reader = dirEntry.createReader();
    const files = [];

    const readAll = async () => {
        const entries = await new Promise((resolve) => reader.readEntries(resolve));
        if (!entries.length) return;

        for (const entry of entries) {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                files.push(file);
            } else if (entry.isDirectory) {
                files.push(...await readDirectory(entry));
            }
        }

        await readAll();
    };

    await readAll();
    return files;
}

document.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
});

document.addEventListener("drop", async (event) => {
    event.preventDefault();

    const items = event.dataTransfer?.items;
    const files = event.dataTransfer?.files;

    if (items && items.length) {
        await handleDroppedFiles(items);
        return;
    }

    if (files && files.length) {
        await handleDroppedFiles(files);
    }
});
