import 'virtual:uno.css'
import '@unocss/reset/tailwind-compat.css'
import type { Keypoint, PoseDetector } from '@tensorflow-models/pose-detection'
import type { KeypointMap, PickedKeypoint } from './detector'
import { detectPose, loadModel } from './detector'

type CheckpointMap = Map<PickedKeypoint, {
  name: string
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  score: number
}>

const btnPlayPause = document.querySelector('[data-play-pause]') as HTMLButtonElement
const btnDetect = document.querySelector('[data-detect]') as HTMLButtonElement
const btnSaveCheckpoint = document.querySelector('[data-setCheckpoint]') as HTMLButtonElement

function loadVideos() {
  const sources = [
    '/2024-06-24 北 Snatch 55KG S1.webm',
    '/2024-06-24 西 Snatch 55KG S1.webm',
    '/2024-06-24 西北 Snatch 55KG S1.webm',
  ]

  const videosContainerEl = document.querySelector<HTMLDivElement>('[data-videos-container]')!
  const templateEl = document.querySelector<HTMLTemplateElement>('#template-video')!
  const DRAW_SCORE = 0.3
  const CHECKPOINT_SCORE = 0.5

  const videos = sources.map((src) => {
    const template = templateEl.content.cloneNode(true) as HTMLTemplateElement
    const video = template.querySelector('video')!
    const canvas = template.querySelector('canvas')!
    const ctx = canvas.getContext('2d')!
    let detector: PoseDetector
    loadModel().then((d) => {
      if (d) {
        detector = d
      }
    })

    async function detect() {
      if (detector) {
        return detectPose(detector, video)
      }
    }

    video.src = src
    let scaleX = 1
    let scaleY = 1
    let id_requestAnimationFrame: number
    let isLoopingDraw = false
    const checkpointMap: CheckpointMap = new Map()
    // function drawCanvas(ctx: CanvasRenderingContext2D) {
    //   ctx.clearRect(0, 0, canvas.width, canvas.height)
    //   ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    // }

    video.addEventListener('loadeddata', (e) => {
      const videoRect = video.getBoundingClientRect()
      //   const aspectRatio = video.videoWidth / video.videoHeight
      canvas.width = videoRect.width
      canvas.height = videoRect.height
      scaleX = canvas.width / video.videoWidth
      scaleY = canvas.height / video.videoHeight

      // fix .webm no duration issue
      setTimeout(() => {
        video.currentTime = 99999
        setTimeout(() => {
          video.currentTime = 34
        }, 1000)
      }, 1000)
    })

    function drawKeypoints(keypointMap: KeypointMap, ctx: CanvasRenderingContext2D, scaleX = 1, scaleY = 1): void {
      const pointRadius = 4
      const color = 'yellow'

      keypointMap.forEach((e) => {
        if (e.score > DRAW_SCORE) {
          ctx.beginPath()
          ctx.arc(e.x * scaleX, e.y * scaleY, pointRadius, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }
      })
    }

    async function drawPoints() {
      const result = await detect()
      if (!result?.hasPointAcrossCenter) {
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawKeypoints(result.keypointMap, ctx, scaleX, scaleY)
      drawCheckpoint()
      console.log(detectMatch(result.keypointMap, checkpointMap))
    }

    function detectMatch(keypointMap: KeypointMap, checkpointMap: CheckpointMap) {
      for (const [k, recordPoint] of checkpointMap) {
        const currentKeypoint = keypointMap.get(k)
        if (!currentKeypoint) {
          return false
        }

        if (currentKeypoint.x < recordPoint.xMin || currentKeypoint.x > recordPoint.xMax
          || currentKeypoint.y < recordPoint.yMin || currentKeypoint.y > recordPoint.yMax
          || currentKeypoint.score < recordPoint.score - 0.2
        ) {
          return false
        }
      }

      return true
    }

    async function saveCheckpoint() {
      const result = await detect()
      if (!result?.hasPointAcrossCenter) {
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawKeypoints(result.keypointMap, ctx, scaleX, scaleY)
      drawCheckpoint()

      const videoRect = video.getBoundingClientRect()
      const tolerateRange = {
        x: videoRect.width / 100 * 10,
        y: videoRect.height / 100 * 5,
      }

      result.keypointMap.forEach((v, k) => {
        if (v.score > CHECKPOINT_SCORE) {
          checkpointMap.set(k, {
            xMin: v.x - tolerateRange.x,
            xMax: v.x + tolerateRange.x,
            yMin: v.y - tolerateRange.y,
            yMax: v.y + tolerateRange.y,
            name: v.name,
            score: v.score,
          })
        }
        else {
          checkpointMap.delete(k)
        }
      })
      console.log('checkpointMap', checkpointMap)
    }

    function drawCheckpoint() {
      // Set styling for the rectangles
      ctx.strokeStyle = 'blue'
      // ctx.lineWidth = 2
      // ctx.fillStyle = 'rgba(255, 0, 0, 0.3)' // Red with 0.3 opacity

      // Loop through the map and draw rectangles
      checkpointMap.forEach((coords, partName) => {
        const width = coords.xMax - coords.xMin
        const height = coords.yMax - coords.yMin
        ctx.beginPath()
        ctx.rect(coords.xMin * scaleX, coords.yMin * scaleY, width * scaleX, height * scaleY)
        // ctx.fill() // Fill with semi-transparent color
        ctx.stroke() // Draw the outline
      })
    }

    async function loopDraw() {
      if (isLoopingDraw === false) {
        cancelAnimationFrame(id_requestAnimationFrame)
        return
      }
      await drawPoints()
      id_requestAnimationFrame = requestAnimationFrame(loopDraw)
    }

    function startLoopDraw() {
      isLoopingDraw = true
      loopDraw()
    }

    function cancelLoopDraw() {
      isLoopingDraw = false
    }

    // video.addEventListener('play', startLoopDraw)
    // video.addEventListener('pause', cancelLoopDraw)

    video.addEventListener('ended', () => btnPlayPause.dataset.playPause = 'pause')

    videosContainerEl.appendChild(template)

    return {
      video,
      canvasCtx: ctx,
      canvas,
      get scaleX() {
        return scaleX
      },
      get scaleY() {
        return scaleY
      },
      drawPoints,
      saveCheckpoint,
    }
  })

  return videos
}

const videos = loadVideos()

btnPlayPause.addEventListener('click', (e) => {
  if (btnPlayPause.dataset.playPause === 'pause') {
    videos.forEach(e => e.video.play())
    btnPlayPause.dataset.playPause = 'play'
  }
  else {
    videos.forEach(e => e.video.pause())
    btnPlayPause.dataset.playPause = 'pause'
  }
})

btnDetect.addEventListener('click', async (e) => {
  for (const e of videos) {
    e.drawPoints()
  }
})

btnSaveCheckpoint.addEventListener('click', async (e) => {
  for (const e of videos) {
    e.saveCheckpoint()
  }
})
