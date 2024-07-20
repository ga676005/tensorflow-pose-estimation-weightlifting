import 'virtual:uno.css'
import '@unocss/reset/tailwind-compat.css'

const btnPlayPause = document.querySelector('[data-play-pause]') as HTMLButtonElement

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

    video.src = src

    let scaleX
    let scaleY

    function drawCanvas(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

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
          drawCanvas(ctx)
        }, 200)
      }, 200)
    })

    let id_requestAnimationFrame: number

    function loopDraw() {
      id_requestAnimationFrame = requestAnimationFrame(() => {
        drawCanvas(ctx)
        loopDraw()
      })
    }

    function cancelLoopDraw() {
      cancelAnimationFrame(id_requestAnimationFrame)
    }

    video.addEventListener('play', loopDraw)
    video.addEventListener('pause', cancelLoopDraw)
    video.addEventListener('ended', () => btnPlayPause.dataset.playPause = 'pause')

    videosContainerEl.appendChild(template)

    return {
      video,
    }
  })

  return videos
}

const videos = loadVideos()

btnPlayPause.addEventListener('click', (e) => {
  btnPlayPause.dataset.playPause = btnPlayPause.dataset.playPause === 'play' ? 'pause' : 'play'
  if (btnPlayPause.dataset.playPause === 'play') {
    videos.forEach(e => e.video.pause())
  }
  else {
    videos.forEach(e => e.video.play())
  }
})
