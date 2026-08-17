import React, {useEffect, useRef, useState} from "react";
import {SafeAreaView,View,Text,TextInput,Pressable,StyleSheet,ScrollView,Alert,Vibration,StatusBar,PanResponder,Modal,useWindowDimensions,AppState,Image} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import {io} from "socket.io-client";
import * as Font from "expo-font";
import {useAudioPlayer} from "expo-audio";
import {CameraView,useCameraPermissions} from "expo-camera";

const C={bg:"#070a13",panel:"#0f172a",blue:"#2563eb",blueDark:"#102a63",red:"#ef4444",redDark:"#641923",white:"#fff",muted:"#94a3b8",green:"#22c55e",border:"#334155"};

function QRIcon(){
  return <View style={styles.qrIconBox}>
    <View style={styles.qrFinder}><View style={styles.qrFinderInner}/></View>
    <View style={[styles.qrFinder,{position:"absolute",right:0,top:0}]}><View style={styles.qrFinderInner}/></View>
    <View style={[styles.qrFinder,{position:"absolute",left:0,bottom:0}]}><View style={styles.qrFinderInner}/></View>
    <View style={styles.qrDotA}/><View style={styles.qrDotB}/><View style={styles.qrDotC}/><View style={styles.qrDotD}/>
  </View>;
}

const ICONS={
  logo:require('./assets/app-logo.png'),
  blue1:require('./assets/punch-blue-new.png'),
  red1:require('./assets/punch-red-new.png'),
  blue2:require('./assets/tpb.png'),
  blue3:require('./assets/head-gear-blue.png'),
  red3:require('./assets/head-gear-red.png'),
  red2:require('./assets/tpr.png'),
  swipe:require('./assets/double.png')
};

function ScoreButton({points,swipeValue,onScore,color,icon,swipeIndicator,vibrationOn,soundOn,playSound,soundKey,iconStyle}){
  const startY=useRef(0);
  const swiping=useRef(false);
  const feedbackFired=useRef(false);
  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    onMoveShouldSetPanResponder:(e,g)=>Boolean(swipeValue && Math.abs(g.dy)>16 && Math.abs(g.dy)>Math.abs(g.dx)*1.15),
    onPanResponderGrant:e=>{startY.current=e.nativeEvent.pageY;swiping.current=true;},
    onPanResponderRelease:(e,g)=>{
      const dy=e.nativeEvent.pageY-startY.current;
      if(swipeValue && dy<=-30){
        if(!feedbackFired.current){if(vibrationOn)Vibration.vibrate(20);if(soundOn)playSound("swipe");}
        onScore(swipeValue,true);
      }
      feedbackFired.current=false;swiping.current=false;startY.current=0;
    },
    onPanResponderTerminate:()=>{feedbackFired.current=false;swiping.current=false;startY.current=0;}
  })).current;
  const fireFeedback=(kind=soundKey)=>{if(vibrationOn)Vibration.vibrate(20);if(soundOn)playSound(kind);feedbackFired.current=true;};
  return <View {...pan.panHandlers} style={styles.scoreBtnWrap}>
    <Pressable
      style={({pressed})=>[styles.scoreBtn,{borderColor:color,backgroundColor:color===C.red?C.redDark:C.blueDark},pressed&&styles.scoreBtnPressed]}
      onPressIn={()=>{if(!swipeValue && !swiping.current)fireFeedback(soundKey);}}
      onPress={()=>{if(!swiping.current){if(swipeValue)fireFeedback(soundKey);onScore(points,false);feedbackFired.current=false;}}}
      onPressOut={()=>{if(!swiping.current)feedbackFired.current=false;}}
      android_ripple={{color:'#ffffff22'}}
      accessibilityRole="button"
      accessibilityLabel={`${color===C.blue?'Blue':'Red'} ${points} point scoring`}
    >
      {swipeIndicator&&<Image source={swipeIndicator} style={styles.swipeIndicator} resizeMode="contain"/>}
      <Image source={icon} style={[styles.scoreIcon,iconStyle]} resizeMode="contain"/>
    </Pressable>
  </View>;
}

export default function App(){
  const {width,height}=useWindowDimensions();
  const landscape=width>height;
  const [serverUrl,setServerUrl]=useState("");
  const [courtCode,setCourtCode]=useState("");
  const [judgeName,setJudgeName]=useState("");
  const [role,setRole]=useState("judge1");
  const [joined,setJoined]=useState(false),[connected,setConnected]=useState(false),[message,setMessage]=useState("");
  const [fullscreen,setFullscreen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [qrScannerOpen,setQrScannerOpen]=useState(false);
  const [qrScanned,setQrScanned]=useState(false);
  const [cameraPermission,requestCameraPermission]=useCameraPermissions();
  const qrLock=useRef(false);
  const [vibrationOn,setVibrationOn]=useState(true);
  const [soundOn,setSoundOn]=useState(true);
  const [fontReady,setFontReady]=useState(false);
  const punchPlayer=useAudioPlayer(require("./assets/punch.mp3"));
  const chestPlayer=useAudioPlayer(require("./assets/chest.mp3"));
  const headPlayer=useAudioPlayer(require("./assets/head.mp3"));
  const swipePlayer=useAudioPlayer(require("./assets/swipe.mp3"));
  const socket=useRef(null);

  useEffect(()=>{
    Font.loadAsync({FastMonkInk:"https://static.wfonts.com/data/2016/09/07/fast-monk/FastMonk_Ink-Regular.ttf"})
      .then(()=>setFontReady(true))
      .catch(()=>setFontReady(false));
  },[]);

  useEffect(()=>{
    ScreenOrientation.lockAsync(joined ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(()=>{});
    if(!joined){
      setFullscreen(false);
      NavigationBar.setVisibilityAsync("visible").catch(()=>{});
    }
    return ()=>{socket.current?.disconnect();};
  },[joined]);

  const applyFullscreen=async(enabled)=>{
    if(enabled){
      await NavigationBar.setPositionAsync("absolute").catch(()=>{});
      await NavigationBar.setVisibilityAsync("hidden").catch(()=>{});
      await NavigationBar.setBehaviorAsync("overlay-swipe").catch(()=>{});
      StatusBar.setHidden(true,"fade");
    }else{
      await NavigationBar.setPositionAsync("relative").catch(()=>{});
      await NavigationBar.setVisibilityAsync("visible").catch(()=>{});
      await NavigationBar.setBehaviorAsync("inset-swipe").catch(()=>{});
      StatusBar.setHidden(false,"fade");
    }
  };

  const toggleFullscreen=async()=>{
    const next=!fullscreen;
    setFullscreen(next);
    await applyFullscreen(next);
  };

  useEffect(()=>{
    if(!joined) return;
    applyFullscreen(fullscreen);
    const sub=AppState.addEventListener("change",state=>{
      if(state==="active" && (!socket.current || !socket.current.connected)) reconnect();
    });
    return ()=>sub.remove();
  },[joined,serverUrl,courtCode,judgeName,role]);

  const createConnection=(showError=true,overrides={})=>{
    const url=(overrides.serverUrl??serverUrl).trim().replace(/\/+$/,"");
    const code=(overrides.courtCode??courtCode).trim();
    if(!/^https?:\/\//i.test(url)){ if(showError)setMessage("Enter a valid scoring server URL."); return; }
    if(!/^\d{4}$/.test(code)){ if(showError)setMessage("Enter the 4-digit Court Code."); return; }

    socket.current?.removeAllListeners?.();
    socket.current?.disconnect();
    const s=io(url,{transports:["websocket","polling"],reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:800,reconnectionDelayMax:3000,timeout:5000});
    socket.current=s;
    s.on("connect",()=>{
      setConnected(true);
      setMessage("");
      s.emit("join",{code,role,name:judgeName.trim()||role.toUpperCase()},r=>{
        if(!r?.ok){setConnected(false); if(showError)setMessage(r?.message||"Unable to join this court."); return;}
        setJoined(true);
      });
    });
    s.on("disconnect",()=>setConnected(false));
    s.on("connect_error",()=>{setConnected(false); if(showError)setMessage("Cannot connect to the scoring computer.");});
  };

  const parseQrPayload=(raw)=>{
    const data=String(raw||"").trim();
    if(!data)return {};
    const clean=(value)=>String(value||"").trim();
    let parsed=null;
    try{ parsed=JSON.parse(data); }catch(e){}
    if(parsed && typeof parsed==="object"){
      return {
        serverUrl:clean(parsed.serverUrl||parsed.server_url||parsed.server||parsed.url),
        courtCode:clean(parsed.courtCode||parsed.court_code||parsed.code||parsed.court)
      };
    }
    try{
      const u=new URL(data);
      const server=clean(u.searchParams.get("serverUrl")||u.searchParams.get("server")||u.searchParams.get("url"));
      const code=clean(u.searchParams.get("courtCode")||u.searchParams.get("court_code")||u.searchParams.get("code")||u.searchParams.get("court"));
      if(server||code)return {serverUrl:server||data.split(/[?#]/)[0],courtCode:code};
      if(/^https?:\/\//i.test(data))return {serverUrl:data.split(/[?#]/)[0],courtCode:""};
    }catch(e){}
    const parts=data.split(/[|,\n]/).map(clean).filter(Boolean);
    const codePart=parts.find(x=>/^\d{4}$/.test(x));
    const urlPart=parts.find(x=>/^https?:\/\//i.test(x));
    if(codePart||urlPart)return {serverUrl:urlPart||"",courtCode:codePart||""};
    if(/^\d{4}$/.test(data))return {serverUrl:"",courtCode:data};
    return {};
  };

  const openQrScanner=async()=>{
    if(!cameraPermission?.granted){
      const result=await requestCameraPermission();
      if(!result.granted){
        Alert.alert("Camera permission needed","Allow camera access to scan the scoring server QR code.");
        return;
      }
    }
    qrLock.current=false;
    setQrScanned(false);
    setQrScannerOpen(true);
  };

  const closeQrScanner=()=>{qrLock.current=false;setQrScannerOpen(false);};

  const handleQrScanned=({data})=>{
    if(qrLock.current)return;
    const result=parseQrPayload(data);
    if(!result.serverUrl || !result.courtCode || !/^\d{4}$/.test(result.courtCode)){
      qrLock.current=true;
      setQrScanned(false);
      Alert.alert("Invalid TKD Scorer QR","The QR code must contain the scoring server address and 4-digit court code.",[
        {text:"SCAN AGAIN",onPress:()=>{qrLock.current=false;setQrScanned(false);}},
        {text:"CLOSE",style:"cancel",onPress:closeQrScanner}
      ]);
      return;
    }
    qrLock.current=true;
    setServerUrl(result.serverUrl);
    setCourtCode(result.courtCode);
    setQrScanned(true);
    setQrScannerOpen(false);
    setMessage("QR scanned. Connecting to Court "+result.courtCode+"…");
    createConnection(true,{serverUrl:result.serverUrl,courtCode:result.courtCode});
  };

  const connect=()=>{ setMessage(""); createConnection(true); };

  const reconnect=()=>{
    setMessage("Reconnecting…");
    setConnected(false);
    createConnection(true);
  };

  const leave=()=>{
    socket.current?.disconnect();
    socket.current=null;
    setJoined(false);
    setConnected(false);
  };

  useEffect(()=>{
    [punchPlayer,chestPlayer,headPlayer,swipePlayer].forEach(p=>{try{p.volume=1;}catch(e){}});
  },[punchPlayer,chestPlayer,headPlayer,swipePlayer]);

  const playSound=(kind)=>{
    const player=kind==="punch"?punchPlayer:kind==="chest"?chestPlayer:kind==="head"?headPlayer:swipePlayer;
    try{player.volume=1;player.seekTo(0);player.play();}catch(e){}
  };

  const score=(corner,points,type="tap")=>{
    if(!socket.current||!connected)return Alert.alert("Not connected","Connect to the court first.");
    socket.current.emit("score",{corner,points,type,judge:judgeName.trim()||role});
  };

  if(!joined)return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
    <ScrollView contentContainerStyle={styles.join} keyboardShouldPersistTaps="handled"><View style={styles.joinContent}>
      <View style={styles.joinHeader}>
        <Image source={ICONS.logo} style={styles.joinLogo} resizeMode="contain"/>
        <View style={styles.versionBadge}><Text style={styles.versionTxt}>v1.7.2</Text></View>
      </View>
      <Text style={styles.title}>JUDGE APP</Text>
      <Text style={styles.brandName}><Text style={[styles.brandAdvance,fontReady&&{fontFamily:"FastMonkInk"}]}>Advance</Text> <Text style={styles.brandTKD}>TKD</Text>Scorer</Text>
      <Text style={styles.sub}>Mobile point input for Advance <Text style={styles.brandTKD}>TKD</Text>Scorer</Text>
      <Pressable onPress={openQrScanner} style={styles.qrConnectBtn} accessibilityRole="button" accessibilityLabel="Scan scoring server QR code">
        <View style={styles.qrIconWrap}><QRIcon/></View>
        <View style={styles.qrBtnTextWrap}>
          <Text style={styles.qrConnectTitle}>SCAN QR TO CONNECT</Text>
          <Text style={styles.qrConnectSub}>Scan the QR code shown by the scoring server</Text>
        </View>
        <Text style={styles.qrArrow}>›</Text>
      </Pressable>
      <Text style={styles.label}>SCORING SERVER</Text>
      <TextInput value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.1.50:3000" placeholderTextColor="#64748b" autoCapitalize="none" keyboardType="url" style={styles.input}/>
      <Text style={styles.label}>COURT CODE</Text>
      <TextInput value={courtCode} onChangeText={v=>setCourtCode(v.replace(/\D/g,"").slice(0,4))} placeholder="ENTER 4-DIGIT CODE" placeholderTextColor="#64748b" keyboardType="number-pad" maxLength={4} style={[styles.input,styles.code]}/>
      <Text style={styles.label}>JUDGE NAME</Text>
      <TextInput value={judgeName} onChangeText={setJudgeName} placeholder="Judge name (optional)" placeholderTextColor="#64748b" style={styles.input}/>
      <Text style={styles.label}>JUDGE POSITION</Text>
      <View style={styles.roles}>{["judge1","judge2","judge3"].map(x=><Pressable key={x} onPress={()=>setRole(x)} style={[styles.role,role===x&&styles.roleOn]}><Text style={styles.roleTxt}>{x.toUpperCase()}</Text></Pressable>)}</View>
      {!!message&&<Text style={styles.error}>{message}</Text>}
      <Pressable onPress={connect} style={styles.joinBtn}><Text style={styles.joinTxt}>JOIN COURT</Text></Pressable>
      <Text style={styles.joinNote}>Keep the phone and scoring computer on the same Wi-Fi network.</Text>
      </View></ScrollView>
  </SafeAreaView>;

  const AppRoot=fullscreen?View:SafeAreaView;
  return <AppRoot style={styles.safe}>
    <StatusBar hidden={fullscreen} translucent={false} barStyle="light-content" backgroundColor={C.bg}/>
    <View style={[styles.app,fullscreen&&styles.appFullscreen]}>
      <View style={styles.topbar}>
        <View style={styles.topLeft}>
          <Image source={ICONS.logo} style={styles.headerLogo} resizeMode="contain"/>
          <Pressable onPress={leave} style={styles.iconBtn}><Text style={styles.iconTxt}>‹</Text></Pressable>
          <View style={styles.courtWrap}><Text style={styles.courtCode}>{courtCode}</Text></View>
        </View>
        <View style={styles.brand}>
          <Text style={styles.appTitle}><Text style={[styles.brandAdvance,fontReady&&{fontFamily:"FastMonkInk"}]}>Advance</Text> <Text style={styles.brandTKD}>TKD</Text>Scorer</Text>
          <Text style={styles.judge}>{role.toUpperCase()}{judgeName?" • "+judgeName:""}</Text>
          <Text style={styles.versionText}>v1.7.2</Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.conn}><View style={[styles.dot,connected&&styles.dotOn]}/><Text style={styles.connTxt}>{connected?"CONNECTED":"DISCONNECTED"}</Text></View>
          <Pressable onPress={reconnect} style={styles.iconBtn} accessibilityLabel="Reconnect"><Text style={styles.refreshTxt}>↻</Text></Pressable>
          <Pressable onPress={toggleFullscreen} style={styles.iconBtn} accessibilityLabel={fullscreen?"Exit fullscreen":"Enter fullscreen"}><Text style={styles.fullscreenTxt}>⛶</Text></Pressable>
          <Pressable onPress={()=>setSettingsOpen(true)} style={styles.iconBtn} accessibilityLabel="Settings"><Text style={styles.settingsTxt}>⚙</Text></Pressable>
          <Pressable onPress={()=>Alert.alert("Judge App","Tap +1, +2 or +3. Swipe UP on +2 for +4 or +3 for +6.")} style={styles.iconBtn}><Text style={styles.helpTxt}>?</Text></Pressable>
        </View>
      </View>

      <View style={styles.judgeArea}>
        <View style={styles.scoreRowOne}>
          <ScoreButton points={1} color={C.red} icon={ICONS.red1} onScore={(p)=>score("red",p)} iconStyle={styles.punchIcon} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="punch"/>
          <ScoreButton points={1} color={C.blue} icon={ICONS.blue1} onScore={(p)=>score("blue",p)} iconStyle={styles.punchIcon} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="punch"/>
        </View>
        <View style={styles.rowGap}/>
        <View style={styles.scoreRowFour}>
          <ScoreButton points={2} swipeValue={4} color={C.red} icon={ICONS.red2} swipeIndicator={ICONS.swipe} onScore={(p)=>score("red",p,"swipe")} iconStyle={styles.bodyIcon} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="chest"/>
          <ScoreButton points={3} swipeValue={6} color={C.red} icon={ICONS.red3} swipeIndicator={ICONS.swipe} onScore={(p)=>score("red",p,"swipe")} iconStyle={styles.redHeadIcon} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="head"/>
          <ScoreButton points={3} swipeValue={6} color={C.blue} icon={ICONS.blue3} swipeIndicator={ICONS.swipe} onScore={(p)=>score("blue",p,"swipe")} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="head"/>
          <ScoreButton points={2} swipeValue={4} color={C.blue} icon={ICONS.blue2} swipeIndicator={ICONS.swipe} onScore={(p)=>score("blue",p,"swipe")} iconStyle={styles.bodyIcon} vibrationOn={vibrationOn} soundOn={soundOn} playSound={playSound} soundKey="chest"/>
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendText}><Text style={styles.redLegend}>RED:</Text> +1 TAP   •   +2 SWIPE UP → +4   •   +3 SWIPE UP → +6</Text>
          <Text style={styles.legendDivider}>|</Text>
          <Text style={styles.legendText}><Text style={styles.blueLegend}>BLUE:</Text> +1 TAP   •   +2 SWIPE UP → +4   •   +3 SWIPE UP → +6</Text>
        </View>
        <View style={styles.feedbackBar}>
          <Text style={styles.feedbackItem}>SOUND <Text style={styles.onTxt}>{soundOn?'ON':'OFF'}</Text></Text>
          <Text style={styles.feedbackItem}>PUNCH <Text style={styles.onTxt}>{soundOn?'ON':'OFF'}</Text></Text>
          <Text style={styles.feedbackItem}>CHEST <Text style={styles.onTxt}>{soundOn?'ON':'OFF'}</Text></Text>
          <Text style={styles.feedbackItem}>HEAD <Text style={styles.onTxt}>{soundOn?'ON':'OFF'}</Text></Text>
          <Text style={styles.feedbackItem}>SWIPE <Text style={styles.onTxt}>{soundOn?'ON':'OFF'}</Text></Text>
          <Text style={styles.feedbackItem}>VIBRATION <Text style={styles.onTxt}>{vibrationOn?'ON':'OFF'}</Text></Text>
        </View>
      </View>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={()=>setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsPanel}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>SETTINGS</Text>
              <Pressable onPress={()=>setSettingsOpen(false)} style={styles.settingsClose}><Text style={styles.settingsCloseTxt}>×</Text></Pressable>
            </View>
            <Text style={styles.settingsSub}>Button feedback</Text>
            <View style={styles.settingRow}>
              <View><Text style={styles.settingName}>Vibration</Text><Text style={styles.settingDesc}>Vibrate when scoring button is pressed</Text></View>
              <Pressable onPress={()=>setVibrationOn(v=>!v)} style={[styles.switch, vibrationOn&&styles.switchOn]} accessibilityRole="switch" accessibilityState={{checked:vibrationOn}}>
                <View style={[styles.switchKnob, vibrationOn&&styles.switchKnobOn]}/>
              </Pressable>
            </View>
            <View style={styles.settingRow}>
              <View><Text style={styles.settingName}>Sound</Text><Text style={styles.settingDesc}>Different sounds for punch, chest, head gear and swipe-up</Text></View>
              <Pressable onPress={()=>setSoundOn(v=>!v)} style={[styles.switch, soundOn&&styles.switchOn]} accessibilityRole="switch" accessibilityState={{checked:soundOn}}>
                <View style={[styles.switchKnob, soundOn&&styles.switchKnobOn]}/>
              </Pressable>
            </View>
            <Pressable onPress={()=>{setVibrationOn(true);setSoundOn(true)}} style={styles.resetFeedback}><Text style={styles.resetFeedbackTxt}>RESET FEEDBACK</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={qrScannerOpen} animationType="slide" onRequestClose={closeQrScanner}>
        <View style={styles.qrModal}>
          <StatusBar barStyle="light-content" backgroundColor="#000"/>
          <View style={styles.qrHeader}>
            <View>
              <Text style={styles.qrModalTitle}>SCAN SCORING SERVER QR</Text>
              <Text style={styles.qrModalSub}>Point the camera at the QR code on the scoring server</Text>
            </View>
            <Pressable onPress={closeQrScanner} style={styles.qrClose}><Text style={styles.qrCloseTxt}>×</Text></Pressable>
          </View>
          <View style={styles.cameraFrame}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{barcodeTypes:["qr"]}}
              onBarcodeScanned={qrScanned?undefined:handleQrScanned}
            />
            <View pointerEvents="none" style={styles.scanOverlay}>
              <View style={styles.scanCornerTL}/><View style={styles.scanCornerTR}/><View style={styles.scanCornerBL}/><View style={styles.scanCornerBR}/>
              <View style={styles.scanLine}/>
            </View>
          </View>
          <Text style={styles.qrHint}>The QR should contain the scoring server address and 4-digit court code.</Text>
          <Pressable onPress={closeQrScanner} style={styles.qrCancel}><Text style={styles.qrCancelTxt}>CANCEL</Text></Pressable>
        </View>
      </Modal>

    </View>
  </AppRoot>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},
 join:{flexGrow:1,paddingHorizontal:26,paddingTop:18,paddingBottom:28},joinContent:{width:"100%",maxWidth:620,alignSelf:"center",flexShrink:1},
 joinHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:64},
 joinLogo:{width:210,height:64},brandName:{color:C.muted,fontSize:13,fontWeight:"900",letterSpacing:1.2,marginTop:2},
 versionBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:7,backgroundColor:"#243b68",borderWidth:1,borderColor:"#4f7dcc"},versionTxt:{color:C.white,fontSize:10,fontWeight:"900",letterSpacing:.5},
 title:{fontSize:31,fontWeight:"900",color:C.white,marginTop:22},sub:{color:C.muted,fontSize:13,marginTop:5,marginBottom:22},
 label:{color:C.muted,fontSize:10,fontWeight:"900",letterSpacing:1.2,marginTop:11,marginBottom:6},
 input:{height:50,borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:"#0d1628",color:C.white,paddingHorizontal:14,fontSize:14},
 code:{fontSize:18,fontWeight:"900",letterSpacing:6,textAlign:"center"},roles:{flexDirection:"row",gap:7},
 role:{flex:1,height:45,borderRadius:9,borderWidth:1,borderColor:C.border,backgroundColor:"#111c30",alignItems:"center",justifyContent:"center"},roleOn:{backgroundColor:"#243b68",borderColor:"#4f7dcc"},roleTxt:{color:C.white,fontSize:10,fontWeight:"900"},
 error:{color:"#f87171",fontSize:12,marginTop:12},joinBtn:{height:54,minHeight:54,borderRadius:11,backgroundColor:C.blue,alignItems:"center",justifyContent:"center",marginTop:20},joinTxt:{color:C.white,fontSize:14,fontWeight:"900",letterSpacing:1},
 joinNote:{color:C.muted,fontSize:11,textAlign:"center",marginTop:20},
 app:{flex:1,paddingHorizontal:8,paddingTop:5,paddingBottom:5},appFullscreen:{paddingTop:0,paddingBottom:0},
 topbar:{height:48,flexDirection:"row",alignItems:"center",position:"relative"},topLeft:{flexDirection:"row",alignItems:"center",gap:8,zIndex:2},topRight:{position:"absolute",right:0,top:0,height:48,flexDirection:"row",alignItems:"center",gap:10,zIndex:3},headerLogo:{width:34,height:34,marginRight:1},iconBtn:{width:38,height:36,borderRadius:9,backgroundColor:"#111827",borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center"},iconTxt:{color:C.white,fontSize:30,lineHeight:30},helpTxt:{color:C.white,fontSize:17,fontWeight:"900"},refreshTxt:{color:C.white,fontSize:25,fontWeight:"900",lineHeight:28},settingsTxt:{color:C.white,fontSize:18,fontWeight:"900"},fullscreenTxt:{color:C.white,fontSize:18,fontWeight:"900"},
 courtWrap:{minWidth:82,alignItems:"center"},courtCode:{fontSize:22,color:C.white,fontWeight:"900",letterSpacing:3},brand:{position:"absolute",left:150,right:150,top:0,height:48,alignItems:"center",justifyContent:"center",zIndex:1},appTitle:{color:C.white,fontSize:17,fontWeight:"900",lineHeight:20,textAlign:"center"},brandAdvance:{color:C.white},brandTKD:{color:C.red,fontWeight:"900",fontFamily:undefined},judge:{color:C.muted,fontSize:7,fontWeight:"800",marginTop:0,textAlign:"center"},versionText:{color:C.muted,fontSize:7,fontWeight:"800",marginTop:1,textAlign:"center"},
 conn:{alignItems:"center",minWidth:82},dot:{width:11,height:11,borderRadius:6,borderWidth:2,borderColor:"#64748b"},dotOn:{backgroundColor:C.green,borderColor:"#86efac"},connTxt:{fontSize:7,color:C.muted,fontWeight:"900",marginTop:2},
 judgeArea:{flex:1,minHeight:0,marginTop:7,justifyContent:"flex-start",paddingHorizontal:8,paddingBottom:2},
 scoreRowOne:{flex:0.62,minHeight:0,flexDirection:"row",gap:14,alignItems:"stretch"},
 rowGap:{height:12,flexGrow:0,flexShrink:0},
 scoreRowFour:{flex:0.88,minHeight:0,flexDirection:"row",gap:14,alignItems:"stretch"},
 scoreBtnWrap:{flex:1,minHeight:0,minWidth:0},
 scoreBtn:{flex:1,minHeight:0,borderRadius:15,borderWidth:3,alignItems:"center",justifyContent:"center",paddingHorizontal:5,overflow:"hidden",position:"relative"},
 scoreBtnPressed:{transform:[{scale:.985}],opacity:.82},scoreIcon:{width:"42%",height:"60%",zIndex:2},punchIcon:{width:"18%",height:"34%"},bodyIcon:{width:"36%",height:"48%"},headIcon:{width:"42%",height:"60%"},redHeadIcon:{width:"45%",height:"63%"},swipeIndicator:{position:"absolute",top:12,width:"82%",height:"48%",opacity:.28,zIndex:1},
 legendRow:{height:20,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},legendText:{color:C.muted,fontSize:7,fontWeight:"900",textAlign:"center",letterSpacing:.2},redLegend:{color:C.red},blueLegend:{color:C.blue},legendDivider:{color:C.border,fontSize:9,fontWeight:"900"},
 feedbackBar:{height:26,marginTop:3,borderRadius:8,borderWidth:1,borderColor:C.border,backgroundColor:"#0b1220",flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingHorizontal:6},feedbackItem:{color:C.muted,fontSize:7,fontWeight:"900",letterSpacing:.4},onTxt:{color:C.green,fontWeight:"900"},
 footerHint:{color:C.muted,fontSize:8,fontWeight:"900",textAlign:"center",paddingVertical:4,letterSpacing:.3},
 qrConnectBtn:{minHeight:78,borderRadius:14,borderWidth:1.5,borderColor:"#3b82f6",backgroundColor:"#0d1b33",flexDirection:"row",alignItems:"center",paddingHorizontal:14,marginTop:4,marginBottom:8},qrIconWrap:{width:58,height:58,borderRadius:12,backgroundColor:C.blue,alignItems:"center",justifyContent:"center",marginRight:14},qrIconBox:{width:38,height:38,position:"relative",backgroundColor:"transparent"},qrFinder:{width:15,height:15,borderWidth:3,borderColor:C.white,alignItems:"center",justifyContent:"center"},qrFinderInner:{width:5,height:5,backgroundColor:C.white},qrDotA:{position:"absolute",right:3,bottom:2,width:6,height:6,backgroundColor:C.white},qrDotB:{position:"absolute",right:12,bottom:2,width:4,height:4,backgroundColor:C.white},qrDotC:{position:"absolute",left:19,bottom:7,width:5,height:5,backgroundColor:C.white},qrDotD:{position:"absolute",right:1,top:20,width:5,height:5,backgroundColor:C.white},qrBtnTextWrap:{flex:1},qrConnectTitle:{color:C.white,fontSize:13,fontWeight:"900",letterSpacing:.7},qrConnectSub:{color:C.muted,fontSize:9,marginTop:3,lineHeight:14},qrArrow:{color:"#60a5fa",fontSize:32,fontWeight:"300",paddingLeft:8},
 qrModal:{flex:1,backgroundColor:"#05070d",padding:18},qrHeader:{minHeight:62,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},qrModalTitle:{color:C.white,fontSize:18,fontWeight:"900",letterSpacing:.6},qrModalSub:{color:C.muted,fontSize:10,marginTop:4,maxWidth:300},qrClose:{width:40,height:40,borderRadius:10,borderWidth:1,borderColor:C.border,backgroundColor:"#111827",alignItems:"center",justifyContent:"center"},qrCloseTxt:{color:C.white,fontSize:28,lineHeight:30},cameraFrame:{flex:1,borderRadius:18,overflow:"hidden",borderWidth:2,borderColor:C.blue,position:"relative",backgroundColor:"#000",maxHeight:620,alignSelf:"center",width:"100%"},camera:{flex:1},scanOverlay:{...StyleSheet.absoluteFillObject,alignItems:"center",justifyContent:"center"},scanCornerTL:{position:"absolute",left:"18%",top:"26%",width:42,height:42,borderLeftWidth:4,borderTopWidth:4,borderColor:C.white,borderTopLeftRadius:7},scanCornerTR:{position:"absolute",right:"18%",top:"26%",width:42,height:42,borderRightWidth:4,borderTopWidth:4,borderColor:C.white,borderTopRightRadius:7},scanCornerBL:{position:"absolute",left:"18%",bottom:"26%",width:42,height:42,borderLeftWidth:4,borderBottomWidth:4,borderColor:C.white,borderBottomLeftRadius:7},scanCornerBR:{position:"absolute",right:"18%",bottom:"26%",width:42,height:42,borderRightWidth:4,borderBottomWidth:4,borderColor:C.white,borderBottomRightRadius:7},scanLine:{width:"64%",height:2,backgroundColor:C.red,opacity:.8},qrHint:{color:C.muted,fontSize:10,textAlign:"center",marginTop:12,lineHeight:16},qrCancel:{height:48,borderRadius:11,borderWidth:1,borderColor:C.border,backgroundColor:"#111827",alignItems:"center",justifyContent:"center",marginTop:12},qrCancelTxt:{color:C.white,fontSize:12,fontWeight:"900",letterSpacing:1},
 modalBackdrop:{flex:1,backgroundColor:"#000000aa",alignItems:"center",justifyContent:"center",padding:20},
 settingsPanel:{width:"min(92%,520px)",backgroundColor:"#0f172a",borderRadius:18,borderWidth:1,borderColor:C.border,padding:20},
 settingsHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 settingsTitle:{color:C.white,fontSize:18,fontWeight:"900",letterSpacing:1},
 settingsClose:{width:34,height:34,borderRadius:9,backgroundColor:"#111827",alignItems:"center",justifyContent:"center"},
 settingsCloseTxt:{color:C.white,fontSize:25,lineHeight:28},
 settingsSub:{color:C.muted,fontSize:11,fontWeight:"800",marginTop:16,marginBottom:4},
 settingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:15,borderBottomWidth:1,borderBottomColor:"#1e293b"},
 settingName:{color:C.white,fontSize:15,fontWeight:"800"},
 settingDesc:{color:C.muted,fontSize:9,marginTop:3,maxWidth:300},
 switch:{width:52,height:30,borderRadius:16,backgroundColor:"#334155",padding:3,justifyContent:"center"},
 switchOn:{backgroundColor:C.green},
 switchKnob:{width:24,height:24,borderRadius:12,backgroundColor:"#e2e8f0"},
 switchKnobOn:{alignSelf:"flex-end"},
 resetFeedback:{marginTop:18,height:44,borderRadius:10,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center",backgroundColor:"#111827"},
 resetFeedbackTxt:{color:C.white,fontSize:11,fontWeight:"900",letterSpacing:.8}
});
