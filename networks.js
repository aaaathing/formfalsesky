/*
networks.js
*/

/** if activation changes enough, other things can be updated */
const activationChangeThreshold = 0.01

const XX1threshold = 0.5
const XX1vmActiveThreshold = 0.01
//function XX1(x){return x/(x+1)}
// (2-abs(x))*x
function contrast(x){return min(max((2-abs(x))*x, 0),1)}

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
	constructor(weight,otherSide){
		this.LWt = weight
		this.Wt = SIG(this.LWt)
		this.otherSide = otherSide
	}
	doLern(Send,Recv,lernRate){
		let srs = Send.AvgSLrn * Recv.AvgSLrn
		let srm = Send.AvgM * Recv.AvgM
		let dwt = XCAL(srs, srm) + Recv.AvgLLrn * XCAL(srs, Recv.AvgL)
		//todo: maybe normalize dwt
		//todo: maybe balance
		this.LWt += dwt*lernRate
		this.LWt = max(min(this.LWt, 1),0)
		this.Wt = SIG(this.LWt)
		if(isNaN(this.Wt))debugger
	}
}
class Ne{
	Act = 0
	Ge = 0
	Gi = 0
	Vm = 0
	/*Inet = 0
	AvgSS = 0
	AvgS = 0
	AvgM = 0*/
	AvgL = 0
	AvgLLrn = 0
	AvgSLrn = 0
	ActM //minus phase
	ActP //plus phase
	totalSynWeight = 0
	x;y;z;w
	constructor(x, y, z, w){
		this.x = x, this.y = y, this.z = z, this.w = w
	}
	/*updateExcite(){
		let excite = 0
		for(let s of this.syns) excite += s.otherSide.Act*s.Wt
		//this.Ge += speed * (1/1.4) * ((excite/this.syns.length) - this.Ge)
		this.Ge = excite
	}*/
	/*updateInhib(inhibRadius){
	}*/
	updateActive(erev,gbar){
		//this.Inet = this.Ge * (erevE - this.Vm) + gbarL * (erevL - this.Vm) + this.Gi * (erevI - this.Vm) //+ Math.random()
		//this.Vm += this.Inet (1/3.3) * this.Inet
		this.Vm = this.Ge * erev.erevE + gbar.gbarL * erev.erevL + this.Gi * erev.erevI
		this.Vm = min(max(this.Vm,0),2)
		let newAct
		if(this.Act < XX1vmActiveThreshold && this.Vm <= XX1threshold){
			newAct = contrast(this.Vm-XX1threshold + Math.random()*0.01)
		}else{
			let geThr = (this.Gi * (erev.erevI - XX1threshold) + gbar.gbarL * (erev.erevL - XX1threshold)) / (XX1threshold - erev.erevE)
			newAct = contrast(this.Ge-geThr + Math.random()*0.01)
		}
		this.Act = newAct /*(1/3.3) * (newAct-this.Act)*/
	}
	/*updateLernAvgs(){
		this.AvgSS += (1/2)*(this.Act-this.AvgSS)
		this.AvgS += (1/2)*(this.AvgSS-this.AvgS)
		this.AvgM += (1/10)*(this.AvgS-this.AvgM)
		this.AvgSLrn = (1-0.1) * this.AvgS + 0.1 * this.AvgM
	}*/
	updateLernAvgsAtMinusPhaseEnd(){
		this.ActM = this.Act
	}
	updateLernAvgsAtPlusPhaseEnd(){
		this.ActP = this.Act
	}
	updateLernAvgsAtTrialEnd(){
		this.AvgSLrn = (1-0.1) * this.ActP + 0.1 * this.ActM // approximation of updateLernAvgs
		this.AvgM = this.ActP*0.5+this.ActM*0.5 //approximation

		this.AvgL += (1/10) * (2.5 * this.AvgM - this.AvgL); this.AvgL = max(this.AvgL, 0.2) //only once per trial
		this.AvgLLrn = ((0.0001 - 0.5) / (2.5 - 0.0001)) * (this.AvgL - 0.0001)
		this.AvgLLrn *= max(abs(this.ActP-this.ActM), 0.01)
	}
	/*doLern(){
		for(let s of this.syns) s.doLern(this)
	}*/
}
//todo: bidirectional path have weight symmetry
//todo: pools
class Path{
	syns = [] // array of arrays
	activations
	constructor({name, sender, reciever, type, lernRate}){
		this.name = name ?? "unnamed"
		this.reciever = reciever
		this.sender = sender
		/**
		 * can be: full
		 */
		this.type = type ?? "full"
		for(let i=0; i<reciever.nodes.length; i++){
			this.syns.push(this.initSynsFor(reciever.nodes[i]))
		}
		this.activations = new Array(reciever.nodes.length).fill(0)
		this.lernRate = lernRate ?? 1
	}
	initSynsFor(n){
		let arr = []
		switch(this.type){
			case "full":{
				for(let i=0; i<this.sender.nodes.length; i++){
					arr.push(new Syn(0.1, i))
				}
				break
			}
		}
		return arr
	}
	updateExcite(){
		let changed = false
		for(let i=0; i<this.reciever.nodes.length; i++){
			let prevAct = this.activations[i]
			this.activations[i] = 0
			for(let s of this.syns[i]){
				this.activations[i] += this.sender.nodes[s.otherSide].Act*s.Wt
			}
			if(abs(prevAct-this.activations[i]) > activationChangeThreshold) changed = true
		}
		console.log("path updateExcite "+this.name)
		return changed
	}
	doLern(){
		for(let i=0; i<this.reciever.nodes.length; i++){
			let nr = this.reciever.nodes[i]
			let si=0
			for(let s of this.syns[i]){
				s.doLern(this.sender.nodes[s.otherSide], nr, this.lernRate)
			}
		}
		console.log("path doLern "+this.name)
	}
}
class Layer{
	nodes = []
	/** paths that send to this layer */
	sendingPaths = []
	/** paths that recieve from this layer */
	recievingPaths = []
	constructor({name,type,w0,w1,w2,w3,inputObj,inhibGainForLayer,inhibGainForPool,maxAndAvgMix,erev,gbar}){
		this.name = name ?? "unnamed"
		/**
		 * type can be: super, input, target
		*/
		this.type = type ?? "super"
		/**
		 * w0 and w1 for amount of pools
		 * w2 and w3 for amount of things in pools
		 */
		this.w0=w0, this.w1=w1??1, this.w2=w2??1, this.w3=w3??1
		for(let x=0;x<this.w0;x++){
			for(let y=0;y<this.w1;y++){
				for(let z=0;z<this.w2;z++){
					for(let w=0;w<this.w3;w++){
						this.nodes.push(new Ne(x,y,z))
					}
				}
			}
		}
		/**
		 * used for type of input and target
		 * if type is target, inputObj should be expected output
		 * @type {Array<number>}
		 */
		this.inputObj = inputObj ?? null
		this.inhibGainForPool = inhibGainForPool ?? 0
		this.inhibGainForLayer = inhibGainForLayer ?? 1

		this.maxAndAvgMix = maxAndAvgMix ?? 0.5

		// info: https://github.com/emer/leabra/blob/main/chans/chans.go
		this.erev = erev ?? {erevE:1, erevL:0.3, erevI: 0.25}
		this.gbar = gbar ?? {gbarE: 1, gbarL: 0.1, gbarI: 1}
	}
	/** update Ge of nodes */
	updateExcite(){
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Ge = 0
		}
		for(let p of this.sendingPaths){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Ge += p.activations[i]
			}
		}
	}
	/** update Gi of nodes */
	updateInhib(){
		let maxGe = 0, avgGe = 0
		for(let x=0; x<this.w0; x++){
			for(let y=0; y<this.w1; y++){
				let maxGePool = 0, avgGePool = 0
				for(let z=0; z<this.w2; z++){
					for(let w=0; w<this.w3; w++){
						let n = this.getNode(x,y,z,w)
						maxGe = max(maxGe,n.Ge)
						avgGe += n.Ge
						maxGePool = max(maxGe,n.Ge)
						avgGePool += n.Ge
					}
				}
				avgGePool /= this.w2*this.w3
				let GiForPool = this.inhibGainForPool * avgGePool+this.maxAndAvgMix*(maxGePool-avgGePool)
				for(let z=0; z<this.w2; z++){
					for(let w=0; w<this.w3; w++){
						this.getNode(x,y,z,w).Gi = GiForPool
					}
				}
			}
		}
		avgGe /= this.w0*this.w1*this.w2*this.w3
		let Gi = this.inhibGainForLayer * avgGe+this.maxAndAvgMix*(maxGe-avgGe)
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Gi = max(this.nodes[i].Gi, Gi)
		}
		// todo: add feedback inhib
	}
	/**
	 * @param {0 | 1} phase 0 for minus phase, 1 for plus phase
	 * @returns true if any activation changes enough
	 */
	tick(phase){
		this.updateExcite()
		if(this.type === "input"){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Ge = this.inputObj[i]
			}
		}
		if(this.type === "target" && phase === 1){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Ge = this.inputObj[i]
			}
		}
		if(this.inhibGainForLayer || this.inhibGainForPool){
			this.updateInhib()
		}
		for(let i=0; i<this.nodes.length; i++){
			let n = this.nodes[i]
			n.updateActive(this.erev,this.gbar)
			if(phase === 0){
				n.updateLernAvgsAtMinusPhaseEnd()
			}else{
				n.updateLernAvgsAtPlusPhaseEnd()
			}
		}
		console.log("layer tick "+this.name)
	}
	getNode(x,y=0,z=0,w=0){
		return this.nodes[((x*this.w1+y)*this.w2+z)*this.w3+w]
	}
	getNodeIndex(x,y=0,z=0,w=0){
		return ((x*this.w1+y)*this.w2+z)*this.w3+w
	}
}
class Network{
	/** @type {Array<Path>} */
	paths = []
	/** @type {Array<Layer>} */
	layers = []
	/** @type {Array<Layer>} */
	inputLayers = []
	/**
	 * @param {0 | 1} phase 0 for minus phase, 1 for plus phase
	 */
	tickPhase(phase){
		let updated = new Set(this.layers), nextUpdated = new Set()
		while(updated.size){
			for(let l of updated){
				l.tick(phase)
			}
			for(let p of this.paths){
				if(updated.has(p.sender)){
					let changed = p.updateExcite()
					if(changed) nextUpdated.add(p.reciever)
				}
			}
			let temp = updated
			updated = nextUpdated
			temp.clear()
			nextUpdated = temp
		}
	}
	tick(){
		console.log("p 0")
		this.tickPhase(0)
		console.log("p 1")
		this.tickPhase(1)
		for(let l of this.layers){
			for(let n of l.nodes){
				n.updateLernAvgsAtTrialEnd()
			}
		}
		for(let p of this.paths) p.doLern()
	}
	addLayer(o){
		let l = new Layer(o)
		this.layers.push(l)
		if(l.type === "input" || l.type === "target") this.inputLayers.push(l)
		return l
	}
	addPath(o){
		let p = new Path(o)
		this.paths.push(p)
		o.reciever.sendingPaths.push(p)
		o.sender.recievingPaths.push(p)
		return p
	}
	getRecieverOfNodeInThisLayer(nodeIndex,layer,thisLayer,thisNodeIndex){
		for(let p of thisLayer.sendingPaths){
			if(p.sender === layer){
				let s = p.syns[thisNodeIndex]
				for(let i=0; i<s.length; i++){
					if(s[i].otherSide === nodeIndex){
						return s[i]
					}
				}
				break
			}
		}
	}
	getSenderOfNodeInThisNode(nodeIndex,layer,thisLayer,thisNodeIndex){
		for(let p of thisLayer.recievingPaths){
			if(p.reciever === layer){
				let s = p.syns[nodeIndex]
				for(let i=0; i<s.length; i++){
					if(s[i].otherSide === thisNodeIndex){
						return s[i]
					}
				}
				break
			}
		}
	}
}

module.exports.Network = Network


/*
let n = new Network(), inp=[], outp=[]
let inply = n.addLayer({w0:3,type:"input",inputObj:inp,inhibGainForLayer:0})
//let hidly = n.addLayer({w:3,type:"super"})
let outly = n.addLayer({w0:3,type:"target",inputObj:outp})
//n.addPath({sender:inply,reciever:hidly})
//n.addPath({sender:hidly,reciever:outly})
let pt=n.addPath({sender:inply,reciever:outly})

inp.splice(0,inp.length, 1,0,0)
outp.splice(0,outp.length, 0,1,0)
n.tick()
console.log(inply)
console.log(outly)
console.log(pt)
debugger

inp.splice(0,inp.length, 1,0,0)
outp.splice(0,outp.length, 1,0,0)
n.tick()
console.log(inply)
console.log(outly)
console.log(pt)
debugger
*/

/*
let n=new Ne(0,0,0), n2=new Ne(1,0,0)
let s=new Syn(0.4,n)
s.otherSide=n
n2.syns.push(s)
function testAct(ge, otherGe){
	n.Ge=ge
	for(let i=0;i<75;i++){
		n2.updateExcite()
		n.updateActive()
		n2.updateActive()
		n.updateLernAvgs()
		n2.updateLernAvgs()
	}
	n.updateLernAvgsAtMinusPhaseEnd()
	n2.updateLernAvgsAtMinusPhaseEnd()
	for(let i=0;i<25;i++){
		//n2.updateExcite()
		n.updateActive()
		n2.Ge=otherGe
		n2.updateActive()
		n.updateLernAvgs()
		n2.updateLernAvgs()
	}
	n.updateLernAvgsAtPlusPhaseEnd()
	n2.updateLernAvgsAtPlusPhaseEnd()
	n2.doLern()
	console.log(n)
	console.log(s.LWt)
	console.log(n2)
}
let it=0
setInterval(()=>{
	console.log(it)
	if(it<10)testAct(1,1)
	else if(it<20) testAct(0,1)
	else if(it<30) testAct(1,0)
	else if(it<40) testAct(0.1,0)
	it++
},1000)
*/