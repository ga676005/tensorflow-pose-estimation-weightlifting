import type { Keypoint, MoveNetModelConfig, Pose, PoseDetector } from '@tensorflow-models/pose-detection'
import { SupportedModels, createDetector, movenet } from '@tensorflow-models/pose-detection'
import { ready } from '@tensorflow/tfjs'

let isReady = false
let isInStartPosition = false
let isInEndPosition = false
let hasPassedKnees = false
let hasDroppedBar = false

export async function loadModel() {
  try {
    await ready()
    const model = SupportedModels.MoveNet
    const detectorConfig: MoveNetModelConfig = {
      modelType: movenet.modelType.SINGLEPOSE_THUNDER,
      enableSmoothing: true,
    }
    const detector = await createDetector(model, detectorConfig)
    isReady = true
    return detector
  }
  catch (error) {
    console.error('loadModel', error)
  }
}

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
    }

    // Detect wrists passing knees
    const wristsAboveKnees = (leftWrist.y < leftKnee.y) && (rightWrist.y < rightKnee.y)
    if (isInStartPosition && wristsAboveKnees && !hasPassedKnees) {
      hasPassedKnees = true
    }

    // Detect ending position
    const wristsAboveShoulders = (leftWrist.y < leftShoulder.y) && (rightWrist.y < rightShoulder.y)
    const wristsAboveNose = (leftWrist.y < nose.y) && (rightWrist.y < nose.y)
    if (wristsAboveShoulders && wristsAboveNose && !isInEndPosition) {
      isInEndPosition = true
      isInStartPosition = false
    }

    // Detect dropping the bar (only check after reaching end position)
    if (isInEndPosition && !hasDroppedBar) {
      const wristsBelowShoulders = (leftWrist.y > leftShoulder.y) && (rightWrist.y > rightShoulder.y)
      if (wristsBelowShoulders) {
        hasDroppedBar = true
        // Reset for next lift
        isInStartPosition = false
        isInEndPosition = false
        hasPassedKnees = false
      }
    }
  }
}

export async function detectPose(detector: PoseDetector, video: HTMLVideoElement) {
  try {
    if (!isReady) {
      return
    }

    const poses = await detector.estimatePoses(video)
    if (poses.length > 0) {
      // detectWeightliftingPositions(poses[0].keypoints)
      return poses[0].keypoints
    }
  }
  catch (error) {
    console.error('Error during pose detection:', error)
  }
}

export function drawKeypoints(keypoints: Keypoint[], ctx: CanvasRenderingContext2D, scaleX = 1, scaleY = 1): void {
  const pointRadius = 4
  const color = 'yellow'

  for (const keypoint of keypoints) {
    if (keypoint.score! > 0.3) {
      ctx.beginPath()
      ctx.arc(keypoint.x * scaleX, keypoint.y * scaleY, pointRadius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    }
  }
}
