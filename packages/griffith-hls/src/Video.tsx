import React, {Component} from 'react'
// TODO: 升级有类型的新版
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'hls.... Remove this comment to see the full error message
import Hls from 'hls.js/dist/hls.light.min'
import {getMasterM3U8Blob} from './utils'

type NativeVideoProps = React.HTMLProps<HTMLVideoElement>
type VideoProps = NativeVideoProps & {
  paused: boolean
  currentQuality: string
  useAutoQuality: boolean
  sources: {quality: string; source: string}[]
  onRef(el: HTMLVideoElement | null): void
}

export default class Video extends Component<VideoProps> {
  hls: any
  src: any
  video: any
  manuallyBuildAdaptiveM3U8Blob = false
  hasLoadStarted = false

  componentDidMount() {
    const {src, sources, useAutoQuality} = this.props
    this.hls = new Hls({autoStartLoad: false})
    this.hls.attachMedia(this.video)

    const isAutoQualitySourceProvided = Boolean(
      sources.find((s) => s.quality === 'auto')
    )

    // 启用自动质量但是又没有提供 auto 规格的 source，那么就尝试本地手动生成
    if (useAutoQuality && !isAutoQualitySourceProvided) {
      const master = getMasterM3U8Blob(sources)
      this.src = URL.createObjectURL(master)
      this.manuallyBuildAdaptiveM3U8Blob = true
    } else {
      this.src = src
    }

    this.hls.loadSource(this.src)
  }

  componentDidUpdate(prevProps: VideoProps) {
    const {currentQuality, sources, paused} = this.props

    // 切换清晰度
    if (currentQuality !== prevProps.currentQuality) {
      const source = sources.find((s) => s.quality === currentQuality)
      if (source) {
        if (this.manuallyBuildAdaptiveM3U8Blob) {
          const levels = this.hls.levels
          const level = levels.findIndex((l: any) =>
            l.url.includes(source.source)
          )
          this.hls.nextLevel = level
        } else {
          // TODO: 没有在 hls 的 API 内部找到顺畅切换 source 的方法
          // 因此这里比较直接和生硬
          const currentTime = this.video.currentTime
          this.hls.destroy()
          this.hls = new Hls({autoStartLoad: false})
          this.hls.attachMedia(this.video)
          this.hls.loadSource(source.source)
          this.video.currentTime = currentTime
          this.hls.startLoad()
          if (!paused) {
            this.video.play()
          }
        }
      } else {
        // 一定意味着选择了手动生成的「auto」
        this.hls.nextLevel = -1
      }
    }

    // 切换播放状态
    if (!paused && prevProps.paused && !this.hasLoadStarted) {
      this.hls.startLoad()
      this.hasLoadStarted = true
    }
  }

  componentWillUnmount() {
    this.hls.destroy()
    if (this.manuallyBuildAdaptiveM3U8Blob) {
      URL.revokeObjectURL(this.src)
    }
  }

  render() {
    const {
      onRef,
      /* eslint-disable no-unused-vars */
      currentQuality,
      useAutoQuality,
      src,
      sources,
      paused,
      /* eslint-enable no-unused-vars */
      ...props
    } = this.props
    return (
      <video
        ref={(el) => {
          if (onRef) {
            onRef(el)
          }
          this.video = el
        }}
        {...props}
      />
    )
  }
}