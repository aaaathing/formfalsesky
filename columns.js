class Region{
	cols = []
	colCount
	potentialRadius = 1
	connectedPermenance = 0.2
	minOverlap//=
	permenanceDec = 0.008
	permenanceInc = 0.05
	synActiveThreshold = 15
	cellsPerColumn = 4
	constructor(options){
		this.minOverlap = (options.potentialRadius ?? this.potentialRadius)*0.1
		Object.assign(this,options)
		for(let i=0; i<this.colCount; i++){
			this.cols.push(new Col(this,i))
		}
	}
	tick(input){
		let neighbours = this.cols
		for(let c of this.cols){
			let overlap = 0
			for(let i of c.potentialSyns){
				if(i.permenance>this.connectedPermenance){
					overlap += input[i.otherSide]
				}
			}
			overlap *= c.boost
			c.overlap = overlap
		}
		let activeCols = []
		let neighboursOverlap = []
		for(let n of neighbours) neighboursOverlap = Math.max(neighboursOverlap,n.overlap)
		let minLocalActivity = neighboursOverlap
		for(let c of this.cols){
			if(c.overlap > this.minOverlap && c.overlap >= minLocalActivity) activeCols.push(c)
		}
		for(let c of activeCols){
			for(let s of c.potentialSyns){
				if(input[s.otherSide]){
					s.permenance = Math.min(s.permenance+this.permenanceInc, 1)
				}else{
					s.permenance = Math.max(s.permenance-this.permenanceDec, 0)
				}
			}
		}
		let maxActiveDutyCycle = 0
		for(let n of neighbours) maxActiveDutyCycle = Math.max(maxActiveDutyCycle,n.activeDutyCycle)
		for(let c of this.cols){
			c.minDutyCycle = 0.01*maxActiveDutyCycle
			c.updateActiveDutyCycle(activeCols)
			//c.boost = c.minDutyCycle/c.activeDutyCycle
			c.updateOverlapDutyCycle(this)
			if(c.overlapDutyCycle < c.minDutyCycle){
				for(let s of c.potentialSyns){
					s.permenance = Math.min(s.permenance+0.1*this.connectedPermenance, 1)
				}
			}
		}
		console.log(this.cols.reduce((a,b)=>a+(activeCols.includes(b))+" "+b.overlap+" "+b.boost+" : | "+b.potentialSyns.reduce((a,c)=>a+c.permenance.toFixed(3)+" "+(input[c.otherSide]?"true ":"false")+" | ","")+"\n",""))


		/*for(let c of activeCols){
			let anyPredictive = false
			for(let i of c.cells){
				i.prevPredictiveState = i.predictiveState
				i.prevActiveState = i.activeState
				if(i.predictiveState){
					i.activeState = true
					anyPredictive = true
					if(){}
				}
			}
			if(!anyPredictive){
				for(let i of c.cells) i.activeState = true
			}
		}
		for(let c of activeCols){
			for(let i of c.cells){
				let actives = 0
				for(let s of i.syns){
					if(this.cols[s.otherSide].cells[s.otherSide1].activeState) actives++
				}
				i.predictiveState = actives>this.synActiveThreshold
				if(actives>this.synActiveThreshold){
					c.adaptSyns(i,this)
				}
				//todo connect to previous active cells
			}
		}*/
	}
}
class Col{
	potentialSyns = []
	overlap
	boost = 1
	activeDutyCycle = 0
	activeDutyCycleAvg = new Array(20).fill(0) //todo: 20 should be changed to 1000
	activeDutyCycleAvgOffset = 0
	overlapDutyCycle = 0
	overlapDutyCycleAvg = new Array(20).fill(0)
	overlapDutyCycleAvgOffset = 0
	cells = []
	constructor(region,x){
		for(let i=Math.max(x-region.potentialRadius,0); i<=Math.min(x+region.potentialRadius,region.colCount-1); i++){
			this.potentialSyns.push({permenance:Math.random()*0.1-0.05+region.connectedPermenance, otherSide:i})
		}
		for(let i=0; i<region.cellsPerColumn; i++){
			this.cells.push({predictiveState:false,prevPredictiveState:false,activeState:false,prevActiveState:false,learnState:false,syns:[]})//todo: add to syns
		}
	}
	updateActiveDutyCycle(activeCols){
		this.activeDutyCycle -= this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset]
		this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset] = activeCols.includes(this)?1:0
		this.activeDutyCycle += this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset]
		this.activeDutyCycleAvgOffset++
		if(this.activeDutyCycleAvgOffset >= this.activeDutyCycleAvg.length){
			this.activeDutyCycleAvgOffset = 0
		}
	}
	updateOverlapDutyCycle(region){
		this.overlapDutyCycle -= this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset]
		this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset] = this.overlap>region.minOverlap?1:0
		this.overlapDutyCycle += this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset]
		this.overlapDutyCycleAvgOffset++
		if(this.overlapDutyCycleAvgOffset >= this.overlapDutyCycleAvg.length){
			this.overlapDutyCycleAvgOffset = 0
		}
	}
	adaptSyns(i,region){//todo change back
		if(i.predictiveState && !i.prevPredictiveState){
			for(let s of i.syns){
				if(region.cols[s.otherSide].cells[s.otherSide1].activeState) s.temporaryPermanence = region.permenanceInc
				else s.temporaryPermanence = -region.permenanceDec
				s.permenance += s.temporaryPermanence//todo: clamp to 0 1
			}
		}else if(i.activeState && !i.prevActiveState){
			for(let s of i.syns){
				s.temporaryPermanence = 0
			}
		}else if((i.prevPredictiveState || i.prevActiveState) && !i.predictiveState && !i.activeState){
			for(let s of i.syns){
				s.permenance -= s.temporaryPermanence
				s.temporaryPermanence = 0
			}
		}
	}
}

let nthLargest
{
let swap = function(list, a, b) {
	var temp = list[a];
	list[a] = list[b];
	list[b] = temp;
}
//returns the index of the first element in the right sublist
var partition = function(list, pivot, a, b) {
	b--;
	while(a <= b) {
		if(list[a] <= pivot) a++;
		else if(list[b] > pivot) b--;
		else swap(list, a, b);
	}
	return a;
}
nthLargest = function(list, n) {
  var i, a = 0, b = list.length, m, pivot;
  if(n < 1) throw new Error("n too small");
  if(list.length < n) throw new Error("n too large");
  list = list.slice(0);
  while(b - a > 1) {
    for(i = a, pivot = 0; i < b; i++) {
      pivot += list[i];
    }
    pivot /= b-a;
    m = partition(list, pivot, a, b);
    if(b - m >= n) a = m; // select right sublist
    else { // select left sublist
      if(m === b) return list[a]; // all elements in sublist are identical
      n -= b - m;
      b = m;
    }
  }
  if(n !== 1) throw new Error();
  return list[a];
}
}


let r=new Region({colCount:4,cellsPerColumn:2})
let i=0
setInterval(()=>{
	r.tick(i<10?[1,0,0,1]:i<20?[0,1,1,0]:[0,0,0,0])
	console.log(i)
	i++
},1000)