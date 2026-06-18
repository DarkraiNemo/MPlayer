document.getElementById('year').textContent = new Date().getFullYear();

document.addEventListener("mousemove", (e) => {
    const title = document.querySelector(".nav-title");
    const rect = title.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleX = (e.clientY - centerY) / 20;
    const angleY = (e.clientX - centerX) / 20;

    title.style.transform = `perspective(300px) rotateX(${-angleX}deg) rotateY(${angleY}deg)`;
});

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
    showTab('dropPlay');
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
