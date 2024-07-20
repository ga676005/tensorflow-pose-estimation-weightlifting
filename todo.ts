import type { Keypoint, MoveNetModelConfig, PoseDetector } from '@tensorflow-models/pose-detection'
import { SupportedModels, createDetector, movenet } from '@tensorflow-models/pose-detection'
import { ready } from '@tensorflow/tfjs'

const errorDiv = document.getElementById('error') as HTMLDivElement

async function loadModel(): Promise<PoseDetector> {
  try {
    await ready()
    const model = SupportedModels.MoveNet
    const detectorConfig: MoveNetModelConfig = {
      modelType: movenet.modelType.SINGLEPOSE_THUNDER,
      enableSmoothing: true,
    }
    return await createDetector(model, detectorConfig)
  }
  catch (error) {
    errorDiv.textContent = `Error loading the model: ${(error as Error).message}`
    throw error
  }
}

// Constants for drawing
const color = 'yellow'
const pointRadius = 4

function drawKeypoints(keypoints: Keypoint[]): void {
  for (const keypoint of keypoints) {
    if (keypoint.score! > 0.3) {
      ctx.beginPath()
      ctx.arc(keypoint.x, keypoint.y, pointRadius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    }
  }
}

let isInStartPosition = false
let isInEndPosition = false
let hasPassedKnees = false
let hasDroppedBar = false
let lastNotificationTime = 0

function detectWeightliftingPositions(keypoints: Keypoint[]): void {
  const keypointMap = new Map(keypoints.map(keypoint => [keypoint.name, keypoint]))

  const leftWrist = keypointMap.get('left_wrist')
  const rightWrist = keypointMap.get('right_wrist')
  const leftKnee = keypointMap.get('left_knee')
  const rightKnee = keypointMap.get('right_knee')
  const leftShoulder = keypointMap.get('left_shoulder')
  const rightShoulder = keypointMap.get('right_shoulder')
  const nose = keypointMap.get('nose')

  if (leftWrist && rightWrist && leftKnee && rightKnee && leftShoulder && rightShoulder && nose) {
    // Detect starting position
    const wristsBelowKnees = (leftWrist.y > leftKnee.y) && (rightWrist.y > rightKnee.y)
    if (wristsBelowKnees && !isInStartPosition) {
      isInStartPosition = true
      isInEndPosition = false
      hasPassedKnees = false
      hasDroppedBar = false
      notifyPositionDetected('Start position detected!')
    }

    // Detect wrists passing knees
    const wristsAboveKnees = (leftWrist.y < leftKnee.y) && (rightWrist.y < rightKnee.y)
    if (isInStartPosition && wristsAboveKnees && !hasPassedKnees) {
      hasPassedKnees = true
      notifyPositionDetected('Lift in progress: Bar passed knees!')
    }

    // Detect ending position
    const wristsAboveShoulders = (leftWrist.y < leftShoulder.y) && (rightWrist.y < rightShoulder.y)
    const wristsAboveNose = (leftWrist.y < nose.y) && (rightWrist.y < nose.y)
    if (wristsAboveShoulders && wristsAboveNose && !isInEndPosition) {
      isInEndPosition = true
      isInStartPosition = false
      notifyPositionDetected('End position detected!')
    }

    // Detect dropping the bar (only check after reaching end position)
    if (isInEndPosition && !hasDroppedBar) {
      const wristsBelowShoulders = (leftWrist.y > leftShoulder.y) && (rightWrist.y > rightShoulder.y)
      if (wristsBelowShoulders) {
        hasDroppedBar = true
        notifyPositionDetected('Bar dropped - lift completed!')
        // Reset for next lift
        isInStartPosition = false
        isInEndPosition = false
        hasPassedKnees = false
      }
    }
  }
}

function notifyPositionDetected(message: string): void {
  const currentTime = Date.now()
  if (currentTime - lastNotificationTime > 1000) { // Limit notifications to once per second
    console.log(message)
    showOnScreenNotification(message)
    lastNotificationTime = currentTime
  }
}

function showOnScreenNotification(message: string): void {
  const notification = document.createElement('div')
  notification.textContent = message
  notification.style.position = 'absolute'
  notification.style.top = '10px'
  notification.style.left = '50%'
  notification.style.transform = 'translateX(-50%)'
  notification.style.background = 'rgba(0, 0, 0, 0.7)'
  notification.style.color = 'white'
  notification.style.padding = '10px'
  notification.style.borderRadius = '5px'
  notification.style.zIndex = '1000'
  document.body.appendChild(notification)

  setTimeout(() => {
    document.body.removeChild(notification)
  }, 2000)
}

async function detectPose(detector: PoseDetector): Promise<void> {
  try {
    const poses = await detector.estimatePoses(video)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (poses.length > 0) {
      drawKeypoints(poses[0].keypoints)
      detectWeightliftingPositions(poses[0].keypoints)
    }

    requestAnimationFrame(() => detectPose(detector))
  }
  catch (error) {
    console.error('Error during pose detection:', error)
  }
}
