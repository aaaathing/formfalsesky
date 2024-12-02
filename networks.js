const speed = 1
const maxAndAvgMix = 0.5
const lernRate = 1

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
	constructor(weight,otherSide){
		this.LWt = weight
		this.Wt = SIG(this.LWt)
		this.otherSide = otherSide
	}
	doLern(Recv){
		let srs = this.otherSide.AvgSLrn * Recv.AvgSLrn
		let srm = this.otherSide.AvgM * Recv.AvgM
		console.log(srs,srm)
		let dwt = XCAL(srs, srm) + Recv.AvgLLrn * XCAL(srs, Recv.AvgL)
		//todo: maybe normalize dwt
		//todo: maybe balance
		//todo: multiply dwt by rate
		this.LWt += dwt*lernRate
		this.Wt = SIG(this.LWt)
	}
}
//todo: bidirectional path have weight symmetry
//todo: pools
class Path{
	syns = [] // array of arrays
	constructor({sender, reciever, type = "full"}){
		this.reciever = reciever
		this.sender = sender
		/**
		 * can be: full
		 */
		this.type = type
		for(let i=0; i<reciever.nodes.length; i++){
			this.syns.push([])
		}
	}//todo: add to syns
	updateExcite(){
		for(let i=0; i<this.reciever.nodes.length; i++){
			for(let s of this.syns[i]){
				this.reciever.nodes[i].Ge += this.sender.nodes[s.otherSide].Act*s.Wt
			}
		}
	}
	doLern(){
		for(let i=0; i<this.reciever.nodes.length; i++){
			this.syns[i].doLern(this.sender.nodes[s.otherSide])
		}
	}
}
class Ne{
	Act = 0
	Ge = 0
	Gi = 0
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
	//syns = []
	x;y;z
	constructor(x, y, z){
		this.x = x
		this.y = y
		this.z = z
	}
	/*updateExcite(){
		let excite = 0
		for(let s of this.syns) excite += s.otherSide.Act*s.Wt
		//this.Ge += speed * (1/1.4) * ((excite/this.syns.length) - this.Ge)
		this.Ge = excite
	}*/
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
		this.Vm += this.Inet //(1/3.3) * this.Inet
		this.Vm = min(max(this.Vm,0),2)
		let newAct
		if(this.Act < XX1vmActiveThreshold && this.Vm <= XX1threshold){
			newAct = max(contrast(this.Vm-XX1threshold), 0)
		}else{
			let geThr = (this.Gi * (erevI - XX1threshold) + gbarL * (erevL - XX1threshold)) / (XX1threshold - erevE)
			newAct = max(contrast(this.Ge-geThr), 0)
		}
		this.Act += (1/3.3) * (newAct-this.Act)
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
		
		this.AvgSLrn=this.ActP // approximation of updateLernAvgs
		this.AvgM = this.ActP*0.5+this.ActM*0.5 //approximation

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
	constructor({type="super", w,h=1,d=1, inputObj=null, inhibRadius=1}){
		/**
		 * type can be: super, input, target
		*/
		this.type = type
		this.w=w;this.h=h;this.d=d
		for(let x=0;x<w;x++){
			for(let y=0;y<h;y++){
				for(let z=0;z<d;z++){
					this.nodes.push(new Ne(x,y,z))
				}
			}
		}
		/**
		 * used for type of input and target
		 * if type is target, inputObj should be expected output
		 * @type {Array<number>}
		 */
		this.inputObj = inputObj
		this.inhibRadius = inhibRadius
	}
	tick(){
		//updateExcite should be done by Path
		if(this.type === "input"){
			for(let i=0; i<this.nodes.length; i++){
				this.nodes[n].Ge = this.inputObj[i]
			}
		}
		const typeIsTarget = this.type === "target"
		if(this.inhibRadius){
			for(let n of this.nodes) n.updateInhib()
		}
		for(let i=0; i<this.nodes.length; i++){
			let n = this.nodes[i]
			n.updateActive()
			n.updateLernAvgsAtMinusPhaseEnd()
			if(typeIsTarget){
				n.Ge = this.inputObj[i]
			}
			n.updateLernAvgsAtPlusPhaseEnd()
			n.Ge = 0 // because Path does updateExcite
		}
	}
	getNode(x,y=0,z=0){
		return this.nodes[(x*this.w+y)*this.h+z]
	}
}
class Network{
	paths = []
	layers = []
	tick(){
		for(let p of this.paths) p.updateExcite()
		for(let l of this.layers) l.tick()
		for(let p of this.paths) p.doLern()
	}
	addLayer(o){ let l = new Layer(o); this.layers.push(l); return l }
	addPath(o){ let p = new Path(o); this.paths.push(p); return p }
}


let n = new Network(), inp=[], outp=[]
let inply = n.addLayer({w:3,type:"input",inputObj:inp})
let hidly = n.addLayer({w:3,type:"super"})
let outly = n.addLayer({w:3,type:"target",inputObj:outp})
n.addPath({sender:inply,reciever:hidly})
n.addPath({sender:hidly,reciever:outly})

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