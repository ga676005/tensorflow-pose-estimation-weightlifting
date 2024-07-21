import type { Keypoint, MoveNetModelConfig, Pose, PoseDetector } from '@tensorflow-models/pose-detection'
import { SupportedModels, createDetector, movenet } from '@tensorflow-models/pose-detection'
import { ready } from '@tensorflow/tfjs'

let isReady = false
let isInStartPosition = false
let isInEndPosition = false
let hasPassedHip = false
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

function detectWeightliftingPositions(keypoints: Keypoint[]) {
  const keypointMap = new Map(keypoints.map(keypoint => [keypoint.name, keypoint]))

  const leftWrist = keypointMap.get('left_wrist')
  const rightWrist = keypointMap.get('right_wrist')
  const leftKnee = keypointMap.get('left_knee')
  const rightKnee = keypointMap.get('right_knee')
  const leftShoulder = keypointMap.get('left_shoulder')
  const rightShoulder = keypointMap.get('right_shoulder')
  const leftHip = keypointMap.get('left_hip')
  const rightHip = keypointMap.get('right_hip')
  const nose = keypointMap.get('nose')

  const isWristBelowKnee = () => {
    return leftWrist?.score && leftWrist?.score > 0.5 && leftKnee?.score && leftKnee.score > 0.5 && leftWrist.y > leftKnee.y
      || rightWrist?.score && rightWrist.score > 0.5 && rightKnee?.score && rightKnee.score > 0.5 && rightWrist.y > rightKnee.y
  }

  const isHipBelowKnee = () => {
    return leftHip?.score && leftHip.score > 0.5 && leftKnee?.score && leftKnee.score > 0.5 && leftHip.y > leftKnee.y
      || rightHip?.score && rightHip.score > 0.5 && rightKnee?.score && rightKnee.score > 0.5 && rightHip.y > rightKnee.y
  }

  const isHipAboveKnee = () => {
    return leftHip?.score && leftHip.score > 0.5 && leftKnee?.score && leftKnee.score > 0.5 && leftHip.y < leftKnee.y
      || rightHip?.score && rightHip.score > 0.5 && rightKnee?.score && rightKnee.score > 0.5 && rightHip.y < rightKnee.y
  }

  const isWristAboveHip = () => {
    return leftWrist?.score && leftWrist.score > 0.5 && leftHip?.score && leftHip.score > 0.5 && leftWrist.y < leftHip.y
      || rightWrist?.score && rightWrist.score > 0.5 && rightHip?.score && rightHip.score > 0.5 && rightWrist.y < rightHip.y
  }

  const isWristAboveNose = () => {
    return leftWrist?.score && leftWrist.score > 0.5 && nose?.score && nose.score > 0.5 && leftWrist.y < nose.y
      || rightWrist?.score && rightWrist.score > 0.5 && nose?.score && nose.score > 0.5 && rightWrist.y < nose.y
  }

  const isWristBelowShoulder = () => {
    return leftWrist?.score && leftWrist.score > 0.5 && leftShoulder?.score && leftShoulder.score > 0.5 && leftWrist.y > leftShoulder.y
      || rightWrist?.score && rightWrist.score > 0.5 && rightShoulder?.score && rightShoulder.score > 0.5 && rightWrist.y > rightShoulder.y
  }

  if (!isInStartPosition && isHipBelowKnee() && isWristBelowKnee()) {
    isInStartPosition = true
    hasDroppedBar = false
    console.log('isInStartPosition')
  }
  else if (!hasPassedHip && isInStartPosition && isHipAboveKnee() && isWristAboveHip()) {
    hasPassedHip = true
    console.log('is lifting')
  }
  else if (!isInEndPosition && isInStartPosition && hasPassedHip && isWristAboveNose()) {
    isInEndPosition = true
    console.log('isInEndPosition')
  }
  else if (!hasDroppedBar && isInStartPosition && hasPassedHip && isInEndPosition && isWristBelowShoulder()) {
    hasDroppedBar = true
    isInStartPosition = false
    hasPassedHip = false
    isInEndPosition = false
    console.log('hasDroppedBar')
  }

  // console.log({
  //   isInStartPosition,
  //   isInEndPosition,
  //   hasPassedKnees,
  //   hasDroppedBar,
  // })
}

export async function detectPose(detector: PoseDetector, video: HTMLVideoElement) {
  try {
    if (!isReady) {
      return
    }

    const poses = await detector.estimatePoses(video)
    if (poses.length > 0) {
      detectWeightliftingPositions(poses[0].keypoints)
      return poses[0].keypoints
    }
  }
  catch (error) {
    console.error('Error during pose detection:', error)
  }
}

const KEYPOINTS = new Set([
  // 'left_ear',
  // 'left_eye',
  // 'right_ear',
  // 'right_eye',
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
])

function getKeypoints(keypoints: Keypoint[]) {

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
