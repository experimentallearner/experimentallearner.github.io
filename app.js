let localStream, peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Connect to signalling
const socket = new SockJS('/signal');
const stomp = Stomp.over(socket);
stomp.connect({}, () => {
  stomp.subscribe('https://webtrc.vercel.app/topic/signals', onSignal);
});

// Get media from camera/mic
navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;
    createPeerConnection();
  });

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks to connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      stomp.send("https://webtrc.vercel.app/app/signal", {}, JSON.stringify({
        type: "candidate",
        candidate: JSON.stringify(event.candidate)
      }));
    }
  };

  // Create offer and send
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      stomp.send("https://webtrc.vercel.app/app/signal", {}, JSON.stringify({
        type: "offer",
        sdp: peerConnection.localDescription
      }));
    });
}

function onSignal(message) {
  const msg = JSON.parse(message.body);
  switch (msg.type) {
    case "offer":
      handleOffer(msg);
      break;
    case "answer":
      peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      break;
    case "candidate":
      peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.candidate)));
      break;
  }
}

function handleOffer(msg) {
  createPeerConnection();
  peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => {
      stomp.send("https://webtrc.vercel.app/app/signal", {}, JSON.stringify({
        type: "answer",
        sdp: peerConnection.localDescription
      }));
    });
}
