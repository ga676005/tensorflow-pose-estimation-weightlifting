import 'virtual:uno.css'
import '@unocss/reset/tailwind-compat.css'
import type { PoseDetector } from '@tensorflow-models/pose-detection'
import { detectPose, drawKeypoints, loadModel } from './detector'

const btnPlayPause = document.querySelector('[data-play-pause]') as HTMLButtonElement
const btnDetect = document.querySelector('[data-detect]') as HTMLButtonElement

function loadVideos() {
  const sources = [
    '2024-06-24 北 Snatch 55KG S1.webm',
    '2024-06-24 西 Snatch 55KG S1.webm',
    '2024-06-24 西北 Snatch 55KG S1.webm',
  ]

  const videosContainerEl = document.querySelector<HTMLDivElement>('[data-videos-container]')!
  const templateEl = document.querySelector<HTMLTemplateElement>('#template-video')!
  const videos = sources.map((src) => {
    const template = (templateEl.content.cloneNode(true) as HTMLTemplateElement).firstElementChild!
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
          video.currentTime = 0
        }, 1000)
      }, 1000)
    })

    let id_requestAnimationFrame: number
    let isLoopingDraw = false

    async function drawPoints() {
      const keypoints = await detect()
      if (keypoints) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawKeypoints(keypoints, ctx, scaleX, scaleY)
      }
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

    video.addEventListener('play', startLoopDraw)
    video.addEventListener('pause', cancelLoopDraw)

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
