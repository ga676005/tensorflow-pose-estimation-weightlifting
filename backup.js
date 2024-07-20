const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve(video);
    });
}

async function loadModel() {
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        quantBytes: 1
    };
    return poseDetection.createDetector(model, detectorConfig);
}

function drawKeypoints(keypoints) {
    for (let i = 0; i < keypoints.length; i++) {
        const keypoint = keypoints[i];
        if (keypoint.score > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
        }
    }
}

async function detectPose(detector) {
    const poses = await detector.estimatePoses(video);
    ctx.drawImage(video, 0, 0, 640, 480);
    
    if (poses.length > 0) {
        drawKeypoints(poses[0].keypoints);
    }

    requestAnimationFrame(() => detectPose(detector));
}

async function run() {
    await setupCamera();
    const detector = await loadModel();
    detectPose(detector);
}

run();