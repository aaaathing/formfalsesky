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


const {max,min,abs} = Math
class Syn{
	Wt
	LWt //linear
	otherSide
}
class Ne{
	Act = 0
	Ge
	Gi
	Targ
	Ext //external input
	Inet = 0
	Vm = 0
	AvgSS
	AvgS
	AvgM
	AvgL
	AvgLLrn
	AvgSLrn
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
	getNode(x,y=0,z=0){
		return this.nodes[(x*this.w+y)*this.h+z]
	}
}


let n=new Ne(0,0,0)
function testAct(ge,gi){
	n.Ge=ge;n.Gi=gi
	n.updateActive()
	console.log( n.Act)
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