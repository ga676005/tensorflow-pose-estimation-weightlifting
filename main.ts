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

interface Checkpoint {
  map: CheckpointMap
  checked: boolean
  videoTime: number
  timestamp: number
}

const btnPlayPause = document.querySelector('[data-play-pause]') as HTMLButtonElement
const btnDetect = document.querySelector('[data-detect]') as HTMLButtonElement
const btnSaveCheckpoint = document.querySelector('[data-setCheckpoint]') as HTMLButtonElement
const btnPlaybackBackward = document.querySelector('[data-playback-backward]') as HTMLButtonElement
const btnPlaybackForward = document.querySelector('[data-playback-forward]') as HTMLButtonElement
const btnPlaybackRate = document.querySelector('[data-playback-rate]') as HTMLInputElement

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
    const el_detectedPoints = template.querySelector('[data-detectedPoints]')!
    const el_checkPointsContainer = template.querySelector('[data-checkPointsContainer]')!
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
    let lastKeypoints: KeypointMap = new Map()
    const checkpoints: CheckpointMap[] = []
    let lastCheckedIndex = -1

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
      let count = 0

      keypointMap.forEach((e) => {
        if (e.score > CHECKPOINT_SCORE) {
          ctx.beginPath()
          ctx.arc(e.x * scaleX, e.y * scaleY, pointRadius, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
          count++
        }
      })

      el_detectedPoints.textContent = count.toString()
    }

    async function drawPoints() {
      const result = await detect()
      if (!result?.hasPointAcrossCenter) {
        return
      }

      lastKeypoints = result.keypointMap
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawKeypoints(result.keypointMap, ctx, scaleX, scaleY)

      // const previousCheckpoint = checkpoints[lastCheckedIndex - 1]
      // const currentCheckpoint = checkpoints[lastCheckedIndex]
      // const nextCheckpoint = checkpoints[lastCheckedIndex + 1]

      if (checkpoints.length < 3) {
        return
      }

      const renderListItemToGreen = (color: string) => {
        const items = [...el_checkPointsContainer.querySelectorAll('li')]
          .filter((e, i) => i <= lastCheckedIndex)
        items.forEach(e => e.style.backgroundColor = color)
      }

      if (lastCheckedIndex === -1 && detectMatch(result.keypointMap, checkpoints[0])) {
        lastCheckedIndex = 0
        drawCheckpoint(checkpoints[lastCheckedIndex], 'lime')
        renderListItemToGreen('green')
        return
      }

      if (lastCheckedIndex === 0 && detectMatch(result.keypointMap, checkpoints[1])) {
        lastCheckedIndex = 1
        drawCheckpoint(checkpoints[lastCheckedIndex], 'lime')
        renderListItemToGreen('green')

        return
      }

      if (lastCheckedIndex >= 1) {
        if (detectMatch(result.keypointMap, checkpoints[lastCheckedIndex - 1])) {
          lastCheckedIndex = -1
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          drawCheckpoint(checkpoints[0], 'blue')
          renderListItemToGreen('blue')

          return
        }

        const nextCheckpoint = checkpoints[lastCheckedIndex + 1]
        if (nextCheckpoint && detectMatch(result.keypointMap, nextCheckpoint)) {
          drawCheckpoint(checkpoints[lastCheckedIndex], 'purple')
          renderListItemToGreen('purple')
          lastCheckedIndex += -1
          console.log('finish!')
        }
      }
    }

    function detectMatch(keypointMap: KeypointMap, checkpointMap: CheckpointMap) {
      if (keypointMap?.size === 0 || checkpointMap?.size === 0) {
        return false
      }

      const tolerateCount = Math.ceil(checkpointMap.size * 0.2)
      let misMatchCount = 0

      for (const [k, recordPoint] of checkpointMap) {
        const currentKeypoint = keypointMap.get(k)
        if (!currentKeypoint) {
          misMatchCount += 1
          continue
        }

        const isNotInBoundary = currentKeypoint.x < recordPoint.xMin
          || currentKeypoint.x > recordPoint.xMax
          || currentKeypoint.y < recordPoint.yMin
          || currentKeypoint.y > recordPoint.yMax

        if (isNotInBoundary) {
          misMatchCount += 1
        }

        if (misMatchCount >= tolerateCount) {
          return false
        }
      }

      return true
    }

    async function saveCheckpoint() {
      const similarCheckpoints = checkpoints.find(e => detectMatch(lastKeypoints, e))

      const videoRect = video.getBoundingClientRect()
      const tolerateRange = {
        x: videoRect.width / 100 * 10,
        y: videoRect.height / 100 * 5,
      }

      const checkpointMap: CheckpointMap = new Map()
      lastKeypoints.forEach((v, k) => {
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
      })

      if (checkpointMap.size < 5) {
        console.log('not saved because checkpointMap.size < 5')
        return
      }

      if (similarCheckpoints) {
        console.log('replace similarCheckpoints')
        checkpoints[checkpoints.indexOf(similarCheckpoints)] = checkpointMap
      }
      else {
        console.log('new checkpoint')
        checkpoints.push(checkpointMap)
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCheckpoint(checkpointMap, 'red')
      renderCheckpointElements()
      // console.log('saveCheckpoint', checkpointMap)
      console.log('checkpoints', checkpoints.length)
    }

    function drawCheckpoint(checkpointMap: CheckpointMap, color: string) {
      // Set styling for the rectangles
      ctx.strokeStyle = color
      ctx.lineWidth = 4
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

    el_checkPointsContainer.addEventListener('click', (e) => {
      const el = e.target as HTMLElement
      if (el.matches('li')) {
        const index = Number.parseInt(el.dataset.checkpointIndex!)
        drawCheckpoint(checkpoints[index], 'black')
      }

      if (el.matches('button')) {
        const index = Number.parseInt(el.dataset.deleteCheckpointIndex!)
        checkpoints.splice(index, 1)
        renderCheckpointElements()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    })

    function renderCheckpointElements() {
      const elements = checkpoints.map((e, i) => {
        const li = document.createElement('li')
        const btn = document.createElement('button')
        li.dataset.checkpointIndex = `${i}`
        li.textContent = `checkpoint index: ${i} , points: ${e.size}`
        btn.textContent = 'X'
        btn.classList.add('ml-4')
        btn.dataset.deleteCheckpointIndex = `${i}`
        li.appendChild(btn)

        return li
      })

      el_checkPointsContainer.innerHTML = ''
      el_checkPointsContainer.append(...elements)
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
      saveCheckpoint,

    }
  })

  return videos
}

const videos = loadVideos()

btnPlayPause.addEventListener('click', (e) => {
  if (btnPlayPause.dataset.playPause === 'pause') {
    videos.forEach((e) => {
      e.video.playbackRate = Number.parseFloat(btnPlaybackRate.value)
      e.video.play()
    })
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

btnPlaybackBackward.addEventListener('click', async (e) => {
  for (const e of videos) {
    e.video.currentTime -= 0.4
  }
})

btnPlaybackForward.addEventListener('click', async (e) => {
  for (const e of videos) {
    e.video.currentTime += 0.4
  }
})
