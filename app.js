const BACKEND_URL = "INSERT_YOUR_RENDER_URL_HERE"; 

const socket = io(BACKEND_URL);

const startBtn = document.getElementById('start-btn');
const skipBtn = document.getElementById('skip-btn');
const stopBtn = document.getElementById('stop-btn');
const statusText = document.getElementById('status-text');
const remoteAudio = document.getElementById('remote-audio');

let localStream;
let peerConnection;

const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

async function getMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch (err) {
        statusText.innerText = "Microphone access denied";
        return false;
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
}

function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteAudio.srcObject = null;
}

startBtn.addEventListener('click', async () => {
    if (!localStream) {
        const hasMedia = await getMedia();
        if (!hasMedia) return;
    }
    
    startBtn.disabled = true;
    skipBtn.disabled = false;
    stopBtn.disabled = false;
    
    statusText.innerText = "Looking for someone...";
    socket.emit('find-partner');
});

skipBtn.addEventListener('click', () => {
    resetConnection();
    socket.emit('skip');
    statusText.innerText = "Looking for someone...";
    socket.emit('find-partner');
});

stopBtn.addEventListener('click', () => {
    resetConnection();
    socket.emit('skip');
    startBtn.disabled = false;
    skipBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.innerText = "Disconnected.";
});

socket.on('partner-found', async (data) => {
    statusText.innerText = "Connecting...";
    createPeerConnection();

    if (data.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer);
    }
});

socket.on('offer', async (offer) => {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    statusText.innerText = "Connected! Start talking.";
});

socket.on('ice-candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {}
});

socket.on('partner-disconnected', () => {
    resetConnection();
    statusText.innerText = "Partner left. Finding someone else...";
    socket.emit('find-partner');
});
  
