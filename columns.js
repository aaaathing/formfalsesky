class LayerSP{
	cols = []
	colCount
	potentialRadius = 1
	connectedPermenance = 0.2
	minOverlap//=
	permenanceDec = 0.008
	permenanceInc = 0.05
	desiredLocalActivity
	constructor(options){
		this.minOverlap = (options.potentialRadius ?? this.potentialRadius)*0.1
		Object.assign(this,options)
		for(let i=0; i<this.colCount; i++){
			this.cols.push(new ColSP(this,i))
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
		let allColsActive = []
		allColsActive.length = this.cols.length
		let neighboursOverlap = []
		for(let n of neighbours) neighboursOverlap.push(n.overlap)
		let minLocalActivity = nthLargest(neighboursOverlap,this.desiredLocalActivity)
		for(let i=0; i<this.cols.length; i++){
			let c = this.cols[i]
			if(c.overlap > this.minOverlap && c.overlap >= minLocalActivity){
				activeCols.push(c)
				allColsActive[i] = 1
			}else{
				allColsActive[i] = 0
			}
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
		for(let i=0; i<this.cols.length; i++){
			let c = this.cols[i]
			c.minDutyCycle = 0.01*maxActiveDutyCycle
			c.updateActiveDutyCycle(allColsActive[i])
			c.boost = Math.max(Math.min(c.minDutyCycle/c.activeDutyCycle || 0, 2),1)
			c.updateOverlapDutyCycle(this)
			if(c.overlapDutyCycle === 0 || c.overlapDutyCycle < c.minDutyCycle){
				for(let s of c.potentialSyns){
					s.permenance = Math.min(s.permenance+0.1*this.connectedPermenance, 1)
				}
			}
		}
		console.log(this.cols.reduce((a,b)=>a+(activeCols.includes(b))+" "+b.overlap+" "+b.boost+" : | "/*+b.potentialSyns.reduce((a,c)=>a+c.permenance.toFixed(3)+" "+(input[c.otherSide]?"true ":"false")+" | ","")*/+"\n",""))
		return allColsActive
	}
}
class ColSP{
	potentialSyns = []
	overlap
	boost = 1
	activeDutyCycle = 0
	activeDutyCycleAvg
	activeDutyCycleAvgOffset = 0
	overlapDutyCycle = 0
	overlapDutyCycleAvg
	overlapDutyCycleAvgOffset = 0
	constructor(region,x){
		this.activeDutyCycleAvg = new Array(1000).fill(0)
		this.overlapDutyCycleAvg = new Array(1000).fill(0)
		for(let i=Math.max(x-region.potentialRadius,0); i<=Math.min(x+region.potentialRadius,region.colCount-1); i++){
			this.potentialSyns.push({permenance:Math.random()*0.1-0.05+region.connectedPermenance, otherSide:i})
		}
	}
	updateActiveDutyCycle(thisActive){
		this.activeDutyCycle -= this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset]
		this.activeDutyCycleAvg[this.activeDutyCycleAvgOffset] = thisActive
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
}

class LayerTM{
	colCount
	cellsPerColumn = 32
	synActiveThreshold = 15
	permenanceDec = 0.008
	permenanceInc = 0.05
	desiredActiveSynOnSegment = 20
	initialPermenance = 0.2
	predictedPermenanceDec = 0.008//todo change
	connectedPermenance = 0.2
	segmentActivationThreshold = 13
	segmentLearningThreshold = 10
	prevWinnerCells = []
	LERN = true
	cols = []
	constructor(options){
		Object.assign(this,options)
		for(let i=0; i<this.colCount; i++){
			let col = new ColTM()
			this.cols.push(col)
			for(let i=0; i<this.cellsPerColumn; i++){
				col.cells.push({active:false,prevActive:false,segments:[]})
			}
		}
	}
	/**
	 * activeCols should be return value of LayerSP
	*/
	tick(activeCols){
		let winnerCells = []
		for(let i=0; i<this.cols.length; i++){
			let c = this.cols[i]
			if(activeCols[i]){
				let hadActive = this.activatePredictedColumnIfPredictedColumn(c,winnerCells)
				if(!hadActive){
					this.burstColumn(c,winnerCells)
				}
			}else{
				if(this.LERN){
					for(let cell of c.cells){
						for(let s of cell.segments){
							if(s.matching){
								for(let syn of s.syns){
									if(syn.otherSide.prevActive/*todo*/) syn.permenance -= this.predictedPermenanceDec
								}
							}
						}
					}
				}
			}
		}
		for(let c of this.cols){
			for(let cell of c.cells){
				cell.prevActive = cell.active
				cell.active = false
				for(let s of cell.segments){
					let numActiveConnected = 0, numActivePotential = 0
					for(let syn of s.syns){
						if(syn.otherSide.active/*todo*/){
							if(syn.permenance >= this.connectedPermenance) numActiveConnected++
							numActivePotential++
						}
					}
					s.active = numActiveConnected >= this.segmentActivationThreshold
					s.matching = numActivePotential >= this.segmentLearningThreshold
					s.numActivePotentialSyns = numActivePotential
				}
			}
		}
		this.prevWinnerCells = winnerCells
	}
	activatePredictedColumnIfPredictedColumn(c,winnerCells){
		let hadActive = false
		for(let cell of c.cells){
			for(let s of cell.segments){
				if(s.active){
					hadActive = true
					cell.active = true
					winnerCells.push(cell)
					if(this.LERN){
						this.learnSegment(s)
					}
				}
			}
		}
		return hadActive
	}
	learnSegment(s){
		for(let syn of s.syns){
			if(syn.otherSide.prevActive)/*todo*/ syn.permenance += this.permenanceInc
			else syn.permenance -= this.permenanceDec
		}
		this.growSyns(s, this.desiredActiveSynOnSegment - s.numActivePotentialSyns)
	}
	growSyns(s, amount){
		let can = this.prevWinnerCells.slice()
		while(can.length && amount){
			let idx = Math.floor(Math.random()*can.length)
			let otherSide = can[idx]
			can.splice(idx,1)
			for(let syn of s.syns){
				if(syn.otherSide === otherSide) continue
			}
			s.syns.push({otherSide/*todo*/, permenance:this.initialPermenance})
			amount--
		}
	}
	burstColumn(c, winnerCells){
		for(let cell of c.cells) cell.active = true
		let hasMatching = false
		for(let cell of c.cells){
			for(let s of cell.segments){
				if(s.matching) hasMatching = true
			}
		}
		let learningSegment, winnerCell
		if(hasMatching){
			[learningSegment, winnerCell] = this.bestMatchingSegment(c)
		}else{
			winnerCell = this.leastUsedCell(c)
			if(this.LERN){
				let s = {syns:[], matching:false, active:false, numActivePotentialSyns:0}
				winnerCell.segments.push(s)
				learningSegment = s
			}
		}
		winnerCells.push(winnerCell)
		if(this.LERN){
			this.learnSegment(learningSegment)
		}
	}
	bestMatchingSegment(c){
		let best, bestScore = -1, cellOfBest
		for(let cell of c.cells){
			for(let s of cell.segments){
				if(s.matching){
					if(s.numActivePotentialSyns>bestScore){
						best = s
						bestScore = s.numActivePotentialSyns
						cellOfBest = cell
					}
				}
			}
		}
		return [best,cellOfBest]
	}
	leastUsedCell(c){ // doesn't break ties randomly
		let fewest = Infinity, fewestCell
		for(let cell of c.cells){
			fewest = Math.min(fewest, cell.segments.length)
			fewestCell = cell
		}
		return fewestCell
	}
}
class ColTM{
	cells = []
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


let r=new LayerSP({colCount:16,cellsPerColumn:2,desiredLocalActivity:3,potentialRadius:4})
let it=0
setInterval(()=>{
	let i=it-10
	if(it<10)i=(it%3)*10+1
	r.tick(i<10?[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]:i<20?[0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0]:[0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0])
	console.log(i)
	it++
},1000)