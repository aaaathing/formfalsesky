const permenanceForConnected = 0.2
const minOverlapFract = 0.5
const neighbourCountForInhibit = 2
const permenanceInc = 0.05
const permenanceDec = 0.008
class Region{
	cols = []
	constructor(){
		
	}
	tick(input){
		let colsOverlap = []
		for(let i=0; i<this.cols.length; i++){
			let c = this.cols[i]
			c.usage--
			if(c.usage <= 0){ // remove current one if not used
				this.cols[i] = this.cols[this.cols.length-1]
				this.cols.pop()
				i--
				continue
			}
			c.input(input)
			colsOverlap.push(c.overlap)
		}
		let minOverlap = this.cols.length ? nthLargest(colsOverlap,Math.min(neighbourCountForInhibit,this.cols.length)) : 0
		let activeCols = []
		for(let c of this.cols){
			if(c.overlap >= minOverlap /*c.inhibit(this.cols)*/ && c.overlap >= input.length*minOverlapFract){
				activeCols.push(c)
				c.usage = 1000
			}
		}
		if(!activeCols.length){
			let overlap = 0
			for(let i=0; i<input.length; i++) overlap += input[i]
			if(overlap >= input.length*minOverlapFract) this.cols.push(new Col(input)) // only add if enough input
		}
		for(let c of activeCols){
			for(let s of c.inputSyn){
				if(input[s.otherSide]){
					s.permenance = Math.min(s.permenance+permenanceInc, 1)
				}else{
					s.permenance = Math.max(s.permenance-permenanceDec, 0)
				}
			}
		}

		console.log(this.cols.reduce((a,b)=>a+(activeCols.includes(b))+" "+b.overlap+" : | "+b.inputSyn.reduce((a,c)=>a+c.permenance.toFixed(3)+" "+(input[c.otherSide]?"true ":"false")+" | ","")+"\n",""))
	}
}

class Col{
	constructor(input){
		this.inputSyn = []
		for(let i=0; i<input.length; i++){
			this.inputSyn.push({permenance:input[i]*0.2-0.1+permenanceForConnected,otherSide:i})
		}
	}
	overlap = 0
	input(input){
		let overlap = 0
		for(let i=0; i<this.inputSyn.length; i++){
			if(input[i] && this.inputSyn[i].permenance > permenanceForConnected) overlap++
		}
		this.overlap = overlap
	}
	/*inhibit(cols){
		let howManyMore = 0
		//for(let x = Math.max(this.x-neighbourSize, 0); x <= Math.max(this.x+neighbourSize, cols.length-1); x++){
		for(let x=0; x<cols.length; x++){
			if(cols[x].overlap > this.overlap){
				howManyMore++
				if(howManyMore === neighbourCountForInhibit){
					return
				}
			}
		}
		return true
	}*/
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

let r=new Region()
let i=0
setInterval(()=>{
	r.tick(i<10?[1,0,0,1]:i<20?[1,1,0,1]:[1,0,0,1])
	console.log(i)
	i++
},1000)