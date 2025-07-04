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
function Sig(w, gain=6, off=1) {
	if(w <= 0) {
		return 0
	}
	if(w >= 1) {
		return 1
	}
	return (1 / (1 + Math.pow((off*(1-w))/w, gain)))
}
function SigInv(w, gain=6, off=1) {
	if(w <= 0){
		return 0
	}
	if(w >= 1){
		return 1
	}
	return 1.0 / (1.0 + Math.pow((1.0-w)/w, 1/gain)/off)
}


const {max,min,abs} = Math
class Syn{
	Wt = 0
	LWt = 0 //linear
	otherSide
	constructor(weight,otherSide){
		this.LWt = weight
		this.Wt = Sig(this.LWt)
		this.otherSide = otherSide
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
	deepBurst = 0
	deepBurstPrev = 0
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
	/*updateLernAvgs(){
		this.AvgSS += (1/2)*(this.Act-this.AvgSS)
		this.AvgS += (1/2)*(this.AvgSS-this.AvgS)
		this.AvgM += (1/10)*(this.AvgS-this.AvgM)
		this.AvgSLrn = (1-0.1) * this.AvgS + 0.1 * this.AvgM
	}*/
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
class Path{
	syns = [] // array of arrays
	excitations
	GScale = 1
	constructor({name, sender, reciever, type, lernRate, shape}){
		this.name = name ?? "unnamed"
		/** @type {LayerBase} */
		this.reciever = reciever
		/** @type {LayerBase} */
		this.sender = sender
		/**
		 * can be: normal, CTtoCtxt, TDPredict
		 * TDPredict is linear and has no weight balance, momentum, normalize
		 */
		this.type = type ?? "normal"
		/**
		 * can be: full
		 */
		this.shape = shape ?? "full"
		for(let i=0; i<reciever.nodes.length; i++){
			this.syns.push(this.initSynsFor(reciever.nodes[i]))
		}
		this.excitations = new Array(reciever.nodes.length).fill(0)
		this.lernRate = lernRate ?? 1
	}
	initSynsFor(n){
		let arr = []
		switch(this.shape){
			case "full":{
				for(let i=0; i<this.sender.nodes.length; i++){
					arr.push(new Syn(0.1, i))
				}
				break
			}
		}
		return arr
	}
	send(updated){
		if(this.type !== "CTtoCtxt"){
			let changed = false
			for(let i=0; i<this.reciever.nodes.length; i++){
				let prevAct = this.excitations[i]
				this.excitations[i] = 0
				for(let s of this.syns[i]){
					this.excitations[i] += this.sender.nodes[s.otherSide].Act*s.Wt*this.GScale
				}
				if(abs(prevAct-this.excitations[i]) > activationChangeThreshold) changed = true
			}
			console.log("path send "+this.name)
			if(changed) updated.add(this.reciever)
		}
	}
	/** only for CTtoCtxt type. done at end of quarter */
	sendCtxtGe(){
		for(let i=0; i<this.reciever.nodes.length; i++){
			this.excitations[i] = 0
			for(let s of this.syns[i]){
				this.excitations[i] += this.sender.nodes[s.otherSide].deepBurst*s.Wt*this.GScale
			}
		}
		console.log("path sendCtxtGe "+this.name)
	}
	doLern(){
		for(let i=0; i<this.reciever.nodes.length; i++){
			let Recv = this.reciever.nodes[i]
			const lernRate = this.lernRate
			let totalWeight = 0
			switch(this.type){
				case "CTtoCtxt":
					const isSuper = this.sender.type === "super"
					for(let s of this.syns[i]){
						const sact = isSuper ? this.sender.nodes[s.otherSide].deepBurstPrev : this.sender.nodes[s.otherSide].ActM /*more correct if it is ActQ0*/
						let srs = sact * Recv.AvgSLrn
						let srm = sact * Recv.AvgM
						let dwt = XCAL(srs, srm) + Recv.AvgLLrn * XCAL(srs, Recv.AvgL)
						//todo: maybe normalize dwt
						//todo: maybe balance
						s.LWt += dwt*lernRate
						s.LWt = max(min(s.LWt, 1),0)
						s.Wt = Sig(s.LWt)
						totalWeight += s.Wt
					}
					break
				case "TDPredict":
					const da = this.reciever.modulatorDopmin
					for(let s of this.syns[i]){
						const Send = this.sender.nodes[s.otherSide]
						let dwt = da * Send.ActM /*more correct if it is ActQ0*/
						s.LWt += dwt*lernRate
						s.Wt = s.LWt // linear and no limits
					}
					break
				default:
					for(let s of this.syns[i]){
						const Send = this.sender.nodes[s.otherSide]
						let srs = Send.AvgSLrn * Recv.AvgSLrn
						let srm = Send.AvgM * Recv.AvgM
						let dwt = XCAL(srs, srm) + Recv.AvgLLrn * XCAL(srs, Recv.AvgL)
						//todo: maybe normalize dwt
						//todo: maybe balance
						s.LWt += dwt*lernRate
						s.LWt = max(min(s.LWt, 1),0)
						s.Wt = Sig(s.LWt)
						totalWeight += s.Wt
					}
			}
			if(totalWeight < XX1threshold){ // increase weight if not enough
				let diff = (XX1threshold-totalWeight)/this.syns[i].length
				for(let s of this.syns[i]){
					s.Wt += diff + Math.random() * 0.1-0.05
					s.LWt = SigInv(s.Wt)
				}
			}
		}
		console.log("path doLern "+this.name)
	}
}
class Pool{
	maxAct = 0
	avgAct = 0
}
const Layer = {}
class LayerBase{
	nodes = []
	pools = []
	/** paths that send to this layer */
	sendingPaths = []
	/** paths that recieve from this layer */
	recievingPaths = []
	/**
	 * type can be: super, input, target, deepCT, deepPulvinar, deepTRN, TDPredict, TDIntegrate, TDDopminSignal
	*/
	type
	modulatorDopmin = 0
	constructor({name,w0,w1,w2,w3,inhibGainForLayer,inhibGainForPool,maxAndAvgMix,erev,gbar}){
		this.name = name ?? "unnamed"
		/**
		 * w0 and w1 for amount of pools
		 * w2 and w3 for amount of nodes in pools
		 * x and y for position of pools
		 * z and w for position of nodes in pools
		 * x is most significant in indexes
		 */
		this.w0=w0, this.w1=w1??1, this.w2=w2??1, this.w3=w3??1
		for(let x=0;x<this.w0;x++){
			for(let y=0;y<this.w1;y++){
				for(let z=0;z<this.w2;z++){
					for(let w=0;w<this.w3;w++){
						this.nodes.push(new Ne(x,y,z))
					}
				}
				this.pools.push(new Pool())
			}
		}
		this.bigPool = new Pool()
		
		this.inhibGainForPool = inhibGainForPool ?? 0
		this.inhibGainForLayer = inhibGainForLayer ?? 1

		this.maxAndAvgMix = maxAndAvgMix ?? 0.5

		// info: https://github.com/emer/leabra/blob/main/chans/chans.go
		this.erev = erev ?? {erevE:1, erevL:0.3, erevI: 0.25}
		this.gbar = gbar ?? {gbarE: 1, gbarL: 0.1, gbarI: 1}
	}
	/** update Ge of nodes */
	recieveFromPath(phase,quarter){
		// default vvv
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Ge = 0
		}
		for(let p of this.sendingPaths){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Ge += p.excitations[i]
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
						this.getNode(x,y,z,w).Gi = GiForPool //todo: maybe use pools
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
	updateMaxAndAvgAct(){
		let maxAct = 0, avgAct = 0
		for(let x=0; x<this.w0; x++){
			for(let y=0; y<this.w1; y++){
				let maxActPool = 0, avgActPool = 0
				for(let z=0; z<this.w2; z++){
					for(let w=0; w<this.w3; w++){
						let n = this.getNode(x,y,z,w)
						maxAct = max(maxAct,n.Act)
						avgAct += n.Act
						maxActPool = max(maxAct,n.Act)
						avgActPool += n.Act
					}
				}
				avgActPool /= this.w2*this.w3
				let pool = this.pools[x*this.w1+y]
				pool.maxAct = maxActPool
				pool.avgAct = avgActPool
			}
		}
		avgAct /= this.w0*this.w1*this.w2*this.w3
		this.bigPool.maxAct = maxAct
		this.bigPool.avgAct = avgAct
	}
	/**
	 * @param {0 | 1} phase 0 for minus phase, 1 for plus phase
	 * @returns true if any activation changes enough
	 */
	tick(phase,quarter){
		this.recieveFromPath(phase,quarter)
		if(this.inhibGainForLayer || this.inhibGainForPool){
			this.updateInhib()
		}

		this.updateActivations(phase,quarter)
		console.log("layer tick "+this.name)
	}
	updateActivations(phase,quarter){
		// update activations
		const erev = this.erev, gbar = this.gbar
		for(let i=0; i<this.nodes.length; i++){
			let n = this.nodes[i]
			//this.Inet = this.Ge * (erevE - this.Vm) + gbarL * (erevL - this.Vm) + this.Gi * (erevI - this.Vm) //+ Math.random()
			//this.Vm += this.Inet (1/3.3) * this.Inet
			/*this.Vm = this.Ge * erev.erevE + gbar.gbarL * erev.erevL + this.Gi * erev.erevI
			this.Vm = min(max(this.Vm,0),2)*/
			let newAct
			/*if(this.Act < XX1vmActiveThreshold && this.Vm <= XX1threshold){
				newAct = contrast(this.Vm-XX1threshold + Math.random()*0.01)
			}else{*/
			let geThr = (n.Gi * (erev.erevI - XX1threshold) + gbar.gbarL * (erev.erevL - XX1threshold)) / (XX1threshold - erev.erevE)
			newAct = contrast(n.Ge-geThr + Math.random()*0.01)
			n.Act = newAct /*(1/3.3) * (newAct-this.Act)*/
			// n.updateLernAvgs()
		}
	}
	cycleEnd(updated){
		for(let p of this.recievingPaths){
			p.send(updated)
		}
	}
	quarterEnd(phase,quarter){
		for(let i=0; i<this.nodes.length; i++){
			let n = this.nodes[i]
			if(phase === 0){
				n.ActM = n.Act
			}else{
				n.ActP = n.Act
			}
		}
	}
	getNode(x,y=0,z=0,w=0){
		return this.nodes[((x*this.w1+y)*this.w2+z)*this.w3+w]
	}
	getNodeIndex(x,y=0,z=0,w=0){
		return ((x*this.w1+y)*this.w2+z)*this.w3+w
	}
}

Layer.input = class extends LayerBase{
	type = "input"
	constructor({inputObj}){
		super(...arguments)
		/**
		 * inputObj here should be input
		 * @type {Array<number>}
		 */
		this.inputObj = inputObj ?? null
	}
	tick(phase,quarter){
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Ge = this.inputObj[i]
		}
		super.tick(...arguments)
	}
	recieveFromPath(){}
}
Layer.target = class extends LayerBase{
	type = "target"
	constructor({inputObj}){
		super(...arguments)
		/**
		 * inputObj here should be expected output
		 * @type {Array<number>}
		 */
		this.inputObj = inputObj ?? null
	}
	tick(phase,quarter){
		if(phase === 1){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Ge = this.inputObj[i]
			}
		}
		super.tick(...arguments)
	}
	recieveFromPath(phase,quarter){
		if(phase !== 1) super.recieveFromPath(...arguments)
	}
}

Layer.super = class extends LayerBase{
	type = "super"
	cycleEnd(){
		//todo: only do if needed
		let threshold = max(this.bigPool.avgAct + this.maxAndAvgMix*(this.bigPool.maxAct-this.bigPool.avgAct), 0.1)
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].deepBurst = this.nodes[i].Act > threshold ? this.nodes[i].Act : 0
		}
		super.cycleEnd(...arguments)
	}
	quarterEnd(phase,quarter){
		for(let p of this.recievingPaths){
			if(p.type === "CTtoCtxt"){
				p.sendCtxtGe()
				for(let i=0; i<this.nodes.length; i++){
					this.nodes[i].deepBurstPrev = this.nodes[i].deepBurst
				}
			}
		}
		super.quarterEnd(...arguments)
	}
}

Layer.deepCT = class extends LayerBase{
	type = "deepCT"
	cycleEnd(){
		//todo: only do if needed
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].deepBurst = this.nodes[i].Act
		}
		super.cycleEnd(...arguments)
	}
	quarterEnd(phase,quarter){
		for(let p of this.recievingPaths){
			if(p.type === "CTtoCtxt") p.sendCtxtGe()
		}
		super.quarterEnd(...arguments)
	}
}
Layer.deepPulvinar = class extends LayerBase{
	type = "deepPulvinar"
	/** @type {Array<Layer>} */
	drivers = []
	recieveFromPath(phase,quarter){
		if(quarter === 4){
			let offset = 0
			for(let driverLayer of this.drivers){
				const isSuper = driverLayer.type === "super"
				const drvAct = driverLayer.bigPool.maxAct, drvInhib = min(drvAct/0.6, 1)
				// only if this layer is 2d and driver layer is 4d or 2d
				for(let z=0; z<driverLayer.w2; z++){
					for(let w=0; w<driverLayer.w3; w++){
						let maxDrvAct = 0, avgDrvAct = 0
						for(let x=0; x<driverLayer.w0; x++){
							for(let y=0; y<driverLayer.w1; y++){
								let pi = x*driverLayer.w1+y
								let pool = driverLayer.pools[pi]
								let pni = (pi*driverLayer.w2 + w)*driverLayer.w3 + z
								let drvAct = (isSuper ? driverLayer.nodes[pni].deepBurst : driverLayer.nodes[pni].Act) / max(pool.maxAct, 0.1)
								maxDrvAct = max(maxDrvAct, drvAct)
								//if(pool.maxAct > 0.5)
								avgDrvAct += drvAct
							}
						}
						avgDrvAct /= driverLayer.w0*driverLayer.w1
						// todo: maybe add binary option
						let drvGe = (avgDrvAct+this.maxAndAvgMix*(maxDrvAct-avgDrvAct)) * 0.3
						this.nodes[offset + z*driverLayer.w4+w].Ge = drvGe /* + (1-drvInhib)*thisNode.Ge*/
					}
				}
				offset += driverLayer.w2*driverLayer.w3
			}
		}else{
			super.recieveFromPath(...arguments)
		}
	}
}
Layer.deepTRN = class extends LayerBase{
	type = "deepTRN"
}

Layer.TDPredict = class extends LayerBase{
	type = "TDPredict"
	updateActivations(phase,quarter){
		if(phase === 1){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Act = this.nodes[i].Ge // plus phase
				// n.updateLernAvgs()
			}
		}else{
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[i].Act = this.nodes[i].ActP // previous plus phase
				// n.updateLernAvgs()
			}
		}
	}
}
Layer.TDIntegrate = class extends LayerBase{
	type = "TDIntegrate"
	constructor({TDPredictLayer,discount}){
		super(...arguments)
		this.TDPredictLayer = TDPredictLayer
		this.discount = discount ?? 0.9
	}
	updateActivations(phase,quarter){
		const ActP = this.TDPredictLayer.nodes[0].ActP
		const Act = this.TDPredictLayer.nodes[0].Act
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Act = phase === 1 ? this.nodes[i].Ge + Act*this.discount : ActP
			// n.updateLernAvgs()
		}
	}
}
Layer.TDDopminSignal = class extends LayerBase{
	type = "TDDopminSignal"
	constructor({TDIntegrateLayer, sendTo}){
		super(...arguments)
		this.TDIntegrateLayer = TDIntegrateLayer
		this.sendTo = sendTo
	}
	updateActivations(phase,quarter){
		const da = this.TDIntegrateLayer.nodes[0].Act - this.TDIntegrateLayer.nodes[0].ActM
		for(let i=0; i<this.nodes.length; i++){
			this.nodes[i].Act = phase === 1 ? da : 0
			// n.updateLernAvgs()
		}
	}
	cycleEnd(){
		const da = this.this.nodes[0].Act
		this.modulatorDopmin = da
		for(let l of this.sendTo){
			l.modulatorDopmin = da
		}
		super.cycleEnd(...arguments)
	}
}

Layer.pbwmMatrix = class extends LayerBase{
	type = "pbwmMatrix"
	updateInhib(){
		
		super.updateInhib(...arguments)
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
	 * @param {0 | 1 | 2 | 3} quarter
	 */
	tickPhase(phase,quarter){
		let updated = new Set(this.layers), nextUpdated = new Set()
		while(updated.size){
			for(let l of updated){
				l.tick(phase,quarter)
			}
			for(let l of updated){
				l.updateMaxAndAvgAct()
			}
			for(let l of updated){
				l.cycleEnd(nextUpdated)
			}
			let temp = updated
			updated = nextUpdated
			temp.clear()
			nextUpdated = temp
		}
		for(let l of this.layers){
			l.quarterEnd(phase,quarter)
		}
	}
	tick(){
		console.log("p 0")
		this.tickPhase(0,1)
		console.log("p 1")
		this.tickPhase(1,3)
		for(let l of this.layers){
			for(let n of l.nodes){
				n.updateLernAvgsAtTrialEnd()
			}
		}
		for(let p of this.paths) p.doLern()
	}
	addLayer(o){
		let l = new Layer[o.type](o)
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