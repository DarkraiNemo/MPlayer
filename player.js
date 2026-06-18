const dropZone = document.getElementById('drop-zone');
const audioPlayer = document.getElementById('audio-player');

const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnNext = document.getElementById('btn-forward');
const btnPrev = document.getElementById('btn-rewind');
const btnStop = document.getElementById('btn-stop');
const btnLoop = document.getElementById('btn-loop');

const volumeSlider = document.getElementById('volume-slider');
const progressSlider = document.getElementById('progress-slider');
const currentTimeEl = document.getElementById('current-time');
const durationTimeEl = document.getElementById('duration-time');
const nowPlayingName = document.getElementById('now-playing-name');
const coverArt = document.getElementById('cover-art');

let playlist = [];
let currentIndex = 0;
let currentUrl = null;
let loopEnabled = false;

function isAudioFile(file) {
    return file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|mid)$/i.test(file.name);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function getTrackTitle(fileName) {
    return fileName.replace(/\.[^/.]+$/, '');
}

function updateNowPlaying(name) {
    if (!nowPlayingName) return;
    nowPlayingName.textContent = name || '-';
}

function clearCurrentUrl() {
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
    }
}

function updateProgress() {
    if (!audioPlayer) return;

    if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    if (durationTimeEl) durationTimeEl.textContent = formatTime(audioPlayer.duration);

    if (progressSlider && Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
        progressSlider.value = Math.round((audioPlayer.currentTime / audioPlayer.duration) * 100);
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function updateCoverArt(file) {
    if (!coverArt) return;

    // fallback
    coverArt.src = 'https://i.imgur.com/JRry7xN.png';

    if (!window.jsmediatags) return;

    try {
        const tags = await new Promise((resolve, reject) => {
            jsmediatags.read(file, {
                onSuccess: ({ tags }) => resolve(tags),
                onError: reject
            });
        });

        const picture = tags.picture;
        if (!picture) return;

        const base64String = picture.data
            .map(byte => String.fromCharCode(byte))
            .join('');

        coverArt.src = `data:${picture.format};base64,${btoa(base64String)}`;
    } catch (err) {
        console.log('Sem capa embutida:', err);
    }
}

function loadTrack(index, shouldPlay = true) {
    if (!playlist.length || index < 0 || index >= playlist.length) return;

    currentIndex = index;
    clearCurrentUrl();

    const file = playlist[currentIndex];
    currentUrl = URL.createObjectURL(file);

    audioPlayer.src = currentUrl;
    updateNowPlaying(getTrackTitle(file.name));
    updateProgress();
    updateCoverArt(file);

    if (shouldPlay) {
        audioPlayer.play().catch(() => {});
    }
}

function renderPlaylist() {
    const playlistTab = document.getElementById('tab-playlist');
    if (!playlistTab) return;

    const items = playlist
        .map((file, index) => `<li data-index="${index}">${file.name}</li>`)
        .join('');

    playlistTab.innerHTML = `
        <article>
            <p><strong>Playlist carregada:</strong></p>
            <ol class="playlist-list">${items}</ol>
        </article>
    `;

    playlistTab.querySelectorAll('li').forEach((item) => {
        item.addEventListener('click', () => {
            loadTrack(Number(item.dataset.index));
        });
    });
}

function showPlaylistTab() {
    if (typeof showTab === 'function') {
        showTab('playlist');
    }
}

async function readDroppedItems(items) {
    const files = [];

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();

        if (entry?.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            files.push(file);
        } else if (entry?.isDirectory) {
            const dirFiles = await readDirectory(entry);
            files.push(...dirFiles);
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

    async function readAll() {
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
    }

    await readAll();
    return files;
}

async function extractZipAudio(file) {
    if (!window.JSZip) return [];

    const zip = await JSZip.loadAsync(file);
    const files = [];

    const entries = Object.values(zip.files);
    for (const entry of entries) {
        if (!entry.dir && isAudioFile({ name: entry.name, type: '' })) {
            const blob = await entry.async('blob');
            files.push(new File([blob], entry.name, { type: 'audio/*' }));
        }
    }

    return files;
}

async function handleDroppedFiles(itemsOrFiles) {
    let droppedFiles = [];

    if (itemsOrFiles instanceof DataTransferItemList) {
        droppedFiles = await readDroppedItems(itemsOrFiles);
    } else {
        droppedFiles = [...itemsOrFiles];
    }

    const zipFiles = droppedFiles.filter((f) => /\.zip$/i.test(f.name));
    const audioFiles = droppedFiles.filter(isAudioFile);

    for (const zip of zipFiles) {
        const extracted = await extractZipAudio(zip);
        audioFiles.push(...extracted);
    }

    const uniqueAudio = audioFiles.filter((file, index, arr) =>
        arr.findIndex((f) => f.name === file.name) === index
    );

    if (uniqueAudio.length === 0) return;

    const startingIndex = playlist.length;
    playlist = [...playlist, ...uniqueAudio]; 
    
    renderPlaylist();
    showPlaylistTab();
    
    if (startingIndex === 0) {
        loadTrack(0);
    }

    playlist = uniqueAudio;
    renderPlaylist();
    showPlaylistTab();
    loadTrack(0);
}

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDroppedFiles(e.dataTransfer.items || e.dataTransfer.files);
});

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
        handleDroppedFiles(e.dataTransfer.items || e.dataTransfer.files);
    });
}

function nextTrack() {
    if (!playlist.length) return;
    loadTrack((currentIndex + 1) % playlist.length);
}

function prevTrack() {
    if (!playlist.length) return;
    loadTrack((currentIndex - 1 + playlist.length) % playlist.length);
}

function stopTrack() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    updateProgress();
}

audioPlayer.addEventListener('ended', nextTrack);
audioPlayer.addEventListener('loadedmetadata', updateProgress);
audioPlayer.addEventListener('timeupdate', updateProgress);

btnPlay?.addEventListener('click', () => audioPlayer.play());
btnPause?.addEventListener('click', () => audioPlayer.pause());
btnNext?.addEventListener('click', nextTrack);
btnPrev?.addEventListener('click', prevTrack);
btnStop?.addEventListener('click', stopTrack);
btnLoop?.addEventListener('click', () => {
    loopEnabled = !loopEnabled;
    audioPlayer.loop = loopEnabled;
    btnLoop.classList.toggle('active', loopEnabled);
});

volumeSlider?.addEventListener('input', () => {
    audioPlayer.volume = Number(volumeSlider.value);
});

progressSlider?.addEventListener('input', () => {
    if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
    audioPlayer.currentTime = (Number(progressSlider.value) / 100) * audioPlayer.duration;
});

['dragenter', 'dragover', 'dragleave'].forEach((eventName) => {
    document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
        handleDroppedFiles(e.dataTransfer.items || e.dataTransfer.files);
    });
}

const visualizerCanvas = document.getElementById('visualizer-canvas');
const visualizerCtx = visualizerCanvas?.getContext('2d');

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let audioData = null;
let visualizerRunning = false;
let visualizerRafId = null;

function resizeVisualizer() {
    if (!visualizerCanvas) return false;

    const rect = visualizerCanvas.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return false;

    if (visualizerCanvas.width !== width) visualizerCanvas.width = width;
    if (visualizerCanvas.height !== height) visualizerCanvas.height = height;

    return true;
}

function startVisualizerLoop() {
    if (visualizerRunning || !visualizerCtx || !visualizerCanvas || !audioPlayer) return;

    audioCtx = audioCtx || new AudioContext();
    analyser = analyser || audioCtx.createAnalyser();
    analyser.fftSize = 64;
    audioData = audioData || new Uint8Array(analyser.frequencyBinCount);

    if (!sourceNode) {
        sourceNode = audioCtx.createMediaElementSource(audioPlayer);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    visualizerRunning = true;

    const draw = () => {
        if (!analyser || !visualizerCtx || !visualizerCanvas) return;

        visualizerRafId = requestAnimationFrame(draw);

        if (!resizeVisualizer()) return;

        analyser.getByteFrequencyData(audioData);

        visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        visualizerCtx.fillStyle = '#14151f';
        visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = visualizerCanvas.width / audioData.length;

        for (let i = 0; i < audioData.length; i++) {
            const barHeight = (audioData[i] / 255) * visualizerCanvas.height;

            visualizerCtx.fillStyle = gradient;
            visualizerCtx.fillRect(
                i * barWidth,
                visualizerCanvas.height - barHeight,
                Math.ceil(barWidth),
                barHeight
            );
        }
    };

    draw();
}

function setupVisualizer() {
    if (!visualizerCanvas || !visualizerCtx) return;

    resizeVisualizer();
    startVisualizerLoop();
}

window.addEventListener('resize', () => {
    resizeVisualizer();
});

window.addEventListener('load', () => {
    resizeVisualizer();
    setTimeout(resizeVisualizer, 100);
    setTimeout(resizeVisualizer, 300);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => {
            resizeVisualizer();
        }, 50);
    }
});

const visualizerObserver = new ResizeObserver(() => {
    resizeVisualizer();
});

if (visualizerCanvas) {
    visualizerObserver.observe(visualizerCanvas);
    if (visualizerCanvas.parentElement) {
        visualizerObserver.observe(visualizerCanvas.parentElement);
    }
}

btnPlay?.addEventListener('click', async () => {
    await audioPlayer.play();
    if (audioCtx?.state === 'suspended') {
        await audioCtx.resume();
    }
    setupVisualizer();
});

audioPlayer?.addEventListener('play', async () => {
    if (audioCtx?.state === 'suspended') {
        await audioCtx.resume();
    }
    setupVisualizer();
});

const gradient = visualizerCtx.createLinearGradient(
    0,
    visualizerCanvas.height,
    0,
    0
);

gradient.addColorStop(0, 'rgba(84, 66, 150, 1)');
gradient.addColorStop(0.2, 'rgba(43, 28, 99, 1)');
gradient.addColorStop(1, 'rgba(20, 12, 48, 1)');

visualizerCtx.fillStyle = gradient;