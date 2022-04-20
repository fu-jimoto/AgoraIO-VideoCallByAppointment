import React, { Component } from 'react';
import AgoraRtcEngine from 'agora-electron-sdk';
import { List } from 'immutable';
import path from 'path';
import os from 'os'
import desktopCapturer from 'electron'
import {videoProfileList, audioProfileList, audioScenarioList} from '../utils/settings'
import {readImage} from '../utils/base64'

export default class App extends Component {
  constructor(props) {
    super(props)

    console.log(window.innerWidth);
    console.log(window.innerHeight);

    this.state = {
      appid: '',
      token: '',
      local: '',
      users: [],
      channel: '',
      videoDevices: [],
      audioDevices: [],
      audioPlaybackDevices: [],
      camera: 0,
      mic: 0,
      speaker: 0,
      encoderConfiguration: 3,
    }
    this.handleJoin()
  }

  getRtcEngine() {
    if(!this.state.appid){
      alert("Please enter appid")
      return
    }
    if(!this.rtcEngine) {
      this.rtcEngine = new AgoraRtcEngine()
      this.rtcEngine.initialize(this.state.appid)
      this.subscribeEvents(this.rtcEngine)
      window.rtcEngine = this.rtcEngine;
      this.setState({
        videoDevices: rtcEngine.getVideoDevices(),
        audioDevices: rtcEngine.getAudioRecordingDevices(),
        audioPlaybackDevices: rtcEngine.getAudioPlaybackDevices(),
      })
    }  
    return this.rtcEngine
  }

  componentDidMount() {
  }

  subscribeEvents = (rtcEngine) => {
    rtcEngine.on('joinedchannel', (channel, uid, elapsed) => {
      console.log(`onJoinChannel channel: ${channel}  uid: ${uid}  version: ${JSON.stringify(rtcEngine.getVersion())})`)
      this.setState({
        local: uid
      });
    });
    rtcEngine.on('userjoined', (uid, elapsed) => {
      console.log(`userJoined ---- ${uid}`)
      rtcEngine.muteRemoteVideoStream(uid, false)
      document.getElementById("wait-text").style.display ="none";
      this.setState({
        users: this.state.users.concat([uid])
      })
    })
    rtcEngine.on('removestream', (uid, reason) => {
      console.log(`useroffline ${uid}`)
      document.getElementById("wait-text").style.display ="block";
      this.setState({
        users: this.state.users.filter(u => u != uid)
      })
    })
    rtcEngine.on('leavechannel', (rtcStats) => {
      console.log(`onleaveChannel----`)
      this.sharingPrepared = false
      this.setState({
        local: '',
        users: [],
        localSharing: false,
        localVideoSource: ''
      })
    })
    rtcEngine.on('audiodevicestatechanged', () => {
      this.setState({
        audioDevices: rtcEngine.getAudioRecordingDevices(),
        audioPlaybackDevices: rtcEngine.getAudioPlaybackDevices()
      })
    })
    rtcEngine.on('videodevicestatechanged', () => {
      this.setState({
        videoDevices: rtcEngine.getVideoDevices()
      })
    })
    rtcEngine.on('streamPublished', (url, error) => {
      console.log(`url: ${url}, err: ${error}`)
    })
    rtcEngine.on('streamUnpublished', (url) => {
      console.log(`url: ${url}`)
    })
    rtcEngine.on('lastmileProbeResult', result => {
      console.log(`lastmileproberesult: ${JSON.stringify(result)}`)
    })
    rtcEngine.on('lastMileQuality', quality => {
      console.log(`lastmilequality: ${JSON.stringify(quality)}`)
    })
    rtcEngine.on('audiovolumeindication', (
      uid,
      volume,
      speakerNumber,
      totalVolume
    ) => {
      console.log(`uid${uid} volume${volume} speakerNumber${speakerNumber} totalVolume${totalVolume}`)
    })
    rtcEngine.on('error', err => {
      console.error(err)
    })
    rtcEngine.on('executefailed', funcName => {
      console.error(funcName, 'failed to execute')
    })
  }

  handleJoin = () => {
    if(!this.state.channel){
      alert("Please enter channel")
      return
    }
    let rtcEngine = this.getRtcEngine()
    rtcEngine.setChannelProfile(0)
    rtcEngine.setAudioProfile(5, 8)
    rtcEngine.enableVideo()
    
    let encoderProfile = videoProfileList[this.state.encoderConfiguration]
    let rett = rtcEngine.setVideoEncoderConfiguration({width: encoderProfile.width, height: encoderProfile.height, frameRate: encoderProfile.fps, bitrate: encoderProfile.bitrate})
    console.log(`setVideoEncoderConfiguration --- ${JSON.stringify(encoderProfile)}  ret: ${rett}`)

    if(this.state.videoDevices.length > 0) {
      rtcEngine.setVideoDevice(this.state.videoDevices[this.state.camera].deviceid)
    }
    if(this.state.audioDevices.length > 0) {
      rtcEngine.setAudioRecordingDevice(this.state.audioDevices[this.state.mic].deviceid);
    }
    if(this.state.audioPlaybackDevices.length > 0) {
      rtcEngine.setAudioPlaybackDevice(this.state.audioDevices[this.state.speaker].deviceid);
    }

    rtcEngine.enableDualStreamMode(true)

    rtcEngine.joinChannel(this.state.token || null, this.state.channel, '',  Number(`${new Date().getTime()}`.slice(7)))
  }

  handleLeave = () => {
    let rtcEngine = this.getRtcEngine()
    rtcEngine.leaveChannel()
    rtcEngine.videoSourceLeave()
  }

  handleCameraChange = e => {
    this.setState({camera: e.currentTarget.value});
    this.getRtcEngine().setVideoDevice(this.state.videoDevices[e.currentTarget.value].deviceid);
  }

  handleMicChange = e => {
    this.setState({mic: e.currentTarget.value});
    this.getRtcEngine().setAudioRecordingDevice(this.state.audioDevices[e.currentTarget.value].deviceid);
  }

  handleSpeakerChange = e => {
    this.setState({speaker: e.currentTarget.value});
    this.getRtcEngine().setAudioPlaybackDevice(this.state.audioPlaybackDevices[e.currentTarget.value].deviceid);
  }

  handleEncoderConfiguration = e => {
    this.setState({
      encoderConfiguration: Number(e.currentTarget.value)
    })
  }

  handleRelease = () => {
    this.setState({
      localVideoSource: "",
      users: [],
      localSharing: false,
      local: ''
    })
    if(this.rtcEngine) {
      this.sharingPrepared = false
      this.rtcEngine.release();
      this.rtcEngine = null;
    }
  }

  

  render() {
    return (
        <div>
          {this.state.users.map((item, key) => (
            <Window key={item} uid={item} rtcEngine={this.rtcEngine} role={'remote'}></Window>
          ))}
          <div id="wait-text">入室までおまちください</div>
        </div>
    )
  }

}

class Window extends Component {
  constructor(props) {
    super(props)
    this.state = {
      loading: false,
      stylesVideo: {width: window.innerWidth+"px",height: window.innerHeight+"px", background: "#000000"}
    }
  }

  componentDidMount() {
    let dom = document.querySelector(`#video-${this.props.uid}`)
    
    if (this.props.role === 'remote') {
      dom && this.props.rtcEngine.subscribe(this.props.uid, dom)
      this.props.rtcEngine.setupViewContentMode(this.props.uid, 1);
    }

  }

  render() {
    return (
      <div id={'video-' + this.props.uid} style={this.state.stylesVideo} ></div>
    )
  }
}
