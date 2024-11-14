class Region{
	cols = []
	constructor(options){
		Object.assign(this,options)
		for(let i=0; i<this.colCount; i++){
			this.cols.push(new Col(this))
		}
	}
	tick(){
		let neighbours = this.cols
		for(let c of this.cols){
			let overlap = 0
			for(let i of c.synPermenances){
				if(i>this.connectedPermenance){
					overlap += i.sourceInput
				}
			}
			if(overlap < this.minOverlap) overlap = 0
			else overlap *= c.boost
			c.overlap = overlap
		}
		let activeCols = []
		let minLocalActivity = nthLargest(neighbours,this.desiredLocalActivity)
		for(let c of this.cols){
			if(c.overlap > 0 && c.overlap >= minLocalActivity) activeCols.push(c)
		}
		for(let c of activeCols){
			for(let s of c.potentialSyns){
				if(s.active){
					s.permenance = Math.min(s.permenance+this.permenanceInc, 1)
				}else{
					s.permenance = Math.max(s.permenance-this.permenanceDec, 0)
				}
			}
		}
		let maxActiveDutyCycle = 0
		for(let n of neighbours) maxActiveDutyCycle = Math.max(maxActiveDutyCycle,n.activeDutyCycle)
		for(let c of activeCols){
			c.minDutyCycle = 0.01*maxActiveDutyCycle
			c.updateActiveDutyCycle()
			c.boost = Math.max(c.minDutyCycle / c.activeDutyCycle, 1)
			c.updateOverlapDutyCycle()
			if(c.overlapDutyCycle < c.minDutyCycle){
				for(let s of c){
					s.permenance *= 1+0.1*this.connectedPermenance
				}
			}
		}


		for(let c of activeCols){
			let anyPredictive = false
			for(let i of c.cells){
				i.prevPredictiveState = i.predictiveState
				i.prevActiveState = i.activeState
				if(i.predictiveState){
					i.activeState = true
					anyPredictive = true
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
					if(s.otherSide.activeState) actives++
				}
				i.predictiveState = actives>this.synActiveThreshold
				if(actives>this.synActiveThreshold){
					c.updateCellSynPermenance(i)
				}
				//todo connect to previous active cells
			}
		}
	}
}
class Col{
	potentialSyns = []
	sourceInput = 0//todo
	overlap
	boost = 1
	activeDutyCycle = 0
	activeDutyCycleAvg = new Array(20)
	activeDutyCycleAvgOffset = 0
	overlapDutyCycle = 0
	overlapDutyCycleAvg = new Array(20)
	overlapDutyCycleAvgOffset = 0
	cells = []
	constructor(region){
		for(let i=0; i<region.colCount; i++){
			this.potentialSyns.push({permenance:Math.random()*0.1-0.05+region.connectedPermenance, active:false}) //todo: make active change
		}
		for(let i=0; i<region.cellsPerColumn; i++){
			this.cells.push({predictiveState:false,prevPredictiveState:false,activeState:false,prevActiveState:false,syns:[]})//todo: add to syns
		}
	}
	updateActiveDutyCycle(activeCols){
		this.activeDutyCycle -= this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset]
		this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset] = activeCols.includes(this)?1:0
		this.activeDutyCycle += this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset]
		this.activeDutyCycleAvgOffset++
		if(this.activeDutyCycleAvgOffset >= this.activeDutyCycleAvg.length){
			this.activeDutyCycleAvgOffset = this.activeDutyCycleAvg.length
		}
	}
	updateOverlapDutyCycle(region){
		this.overlapDutyCycle -= this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset]
		this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset] = this.overlap>region.minOverlap?1:0
		this.overlapDutyCycle += this.overlapDutyCycleAvg[this.overlapDutyCycleAvgOffset]
		this.overlapDutyCycleAvgOffset++
		if(this.overlapDutyCycleAvgOffset >= this.overlapDutyCycleAvg.length){
			this.overlapDutyCycleAvgOffset = this.overlapDutyCycleAvg.length
		}
	}
	updateCellSynPermenance(i){
		if(i.predictiveState && !i.prevPredictiveState){
			for(let s of i.syns){
				if(s.otherSide.activeState) s.temporaryPermanence = this.permenanceInc
				else s.temporaryPermanence = -this.permenanceDec
				s.permenance += s.temporaryPermanence
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