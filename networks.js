const speed = 1
const maxAndAvgMix = 0.5

// info: https://github.com/emer/leabra/blob/main/chans/chans.go
const erevE = 1, erevL = 0.3, erevI = 0.25
const gbarE = 1, gbarL = 0.1, gbarI = 1

const XX1threshold = 0.5
const XX1vmActiveThreshold = 0.01
//function XX1(x){return x/(x+1)}
// (2-abs(x))*x
function contrast(x){return (2-abs(x))*x}

const XCALDThr = 0.0001, XCALDRev = 0.1
function XCAL(x, th){
	return (x < XCALDThr) ? 0 : (x > th * XCALDRev) ? (x - th) : (-x * ((1-XCALDRev)/XCALDRev))
}
const SIGOff = 0.5
function SIG(w){
	return 1 / (1 + (SIGOff * (1-w)/w)**2.5)
}


const {max,min,abs} = Math
class Syn{
	Wt = 0
	LWt = 0 //linear
	otherSide
	doLern(Send){
		let srs = Send.AvgSLrn * this.otherSide.AvgSLrn
		let srm = Send.AvgM * this.otherSide.AvgM
		let dwt = XCAL(srs, srm) + this.otherSide.AvgLLrn * XCAL(srs, this.otherSide.AvgL)
		//todo: maybe normalize dwt
		//todo: maybe balance
		this.LWt += dwt
		this.Wt = SIG(this.LWt)
	}
}
class Ne{
	Act = 0
	Ge
	Gi
	Targ
	Ext //external input
	Inet = 0
	Vm = 0
	AvgSS = 0
	AvgS = 0
	AvgM = 0
	AvgL = 0
	AvgLLrn = 0
	AvgSLrn = 0
	ActM //minus phase
	ActP //plus phase
	syns = []
	x;y;z
	constructor(x, y, z){
		this.x = x
		this.y = y
		this.z = z
	}
	updateExcite(){
		let excite = 0
		for(let s of this.syns) excite += s.otherSide.Act*s.Wt
		this.Ge += speed * (1/1.4) * ((excite/this.syns.length) - this.Ge)
	}
	updateInhib(layer){
		let maxGe = 0, avgGe = 0
		for(let x=-layer.inhibRadius; x<=layer.inhibRadius; x++){
			for(let y=-layer.inhibRadius; y<=layer.inhibRadius; y++){
				for(let z=-layer.inhibRadius; z<=layer.inhibRadius; z++){
					let n = layer.getNode(x+this.x,y+this.y,z+this.z)
					if(!n)continue
					maxGe = max(maxGe,n.Ge)
					avgGe += n.Ge
				}
			}
		}
		avg /= layer.inhibRadius*layer.inhibRadius*layer.inhibRadius
		this.Gi = avgGe+maxAndAvgMix*(maxGe-avgGe)
		// todo: add feedback inhib
	}
	updateActive(){
		this.Inet = this.Ge * (erevE - this.Vm) + gbarL * (erevL - this.Vm) + this.Gi * (erevI - this.Vm) //+ Math.random()
		this.Vm += (1/3.3) * this.Inet
		let newAct
		/*if(this.Act < XX1vmActiveThreshold && this.Vm <= XX1threshold){
			newAct = XX1(this.Vm-XX1threshold)
		}else*/{
			let geThr = (this.Gi * (erevI - XX1threshold) + gbarL * (erevL - XX1threshold)) / (XX1threshold - erevE)
			newAct = contrast(contrast(this.Ge-geThr))
		}
		this.Act += (1/3.3) * (newAct-this.Act)
	}
	updateLernAvgs(){
		this.AvgSS += (1/2)*(this.Act-this.AvgSS)
		this.AvgS += (1/2)*(this.Act-this.AvgS)
		this.AvgM += (1/10)*(this.Act-this.AvgM)
		this.AvgSLrn = (1-0.1) * this.AvgS + 0.1 * this.AvgM
	}
	updateLernAvgsAtMinusPhaseEnd(){
		this.ActM = this.Act
	}
	updateLernAvgsAtPlusPhaseEnd(){
		this.ActP = this.Act
		this.AvgL += (1/10) * (2.5 * this.AvgM - this.AvgL); this.AvgL = max(this.AvgL, 0.2) //only once per trial
		this.AvgLLrn = ((0.0001 - 0.5) / (2.5 - 0.0001)) * (this.AvgL - 0.0001)
		this.AvgLLrn *= max(abs(this.ActP-this.ActM), 0.01)
	}
	doLern(){
		for(let s of this.syns) s.doLern(this)
	}
}
class Layer{
	nodes = []
	w;h;d
	inhibRadius = 1
	constructor(w,h=1,d=1){
		this.w=w;this.h=h;this.d=d
		for(let x=0;x<w;x++){
			for(let y=0;y<h;y++){
				for(let z=0;z<d;z++){
					this.nodes.push(new Ne(x,y,z))
				}
			}
		}
	}
	tick(){

	}
	getNode(x,y=0,z=0){
		return this.nodes[(x*this.w+y)*this.h+z]
	}
}


let n=new Ne(0,0,0), s=new Syn()
s.Wt=s.LWt=1
s.otherSide=new Ne(1,0,0)
n.syns.push(s)
function testAct(ge,gi){
	n.Ge=ge;n.Gi=gi
	n.updateActive()
	console.log(n)
	console.log(s.LWt)
	console.log(s.otherSide)
}
let it=0
setInterval(()=>{
	console.log(it)
	if(it<10)testAct(1,0)
	else if(it<20) testAct(0,0)
	else if(it<30) testAct(0.25,0)
	else if(it<40) testAct(0.1,0)
	it++
},1000)