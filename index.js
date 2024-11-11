const {round, min,max} = Math

let processes = {}

processes.SemanticMemoryProcess = class{
	/**
	 * @type {Map<string, memory>}
	 */
	things = new Map()
	find(a, charge){
		let {what,arr} = this.things.get(a)
		this.superProcess.processesMap.TemporaryMemory.add(structuredClone(what), this.constructor.equals, charge)
		for(let i=0; i<arr.length; i+=2){
			if(charge*arr[i+1] > 0.5){
				this.find(arr[i], charge*arr[i+1])
			}
		}
	}
	add(newOne){}
	static equals(a,b){
		if(a.a.length !== b.a.length || a.b !== b.b) return false
		for(let i=0; i<a.a.length; i++){
			if(a.a[i] !== b.a[i]) return false
		}
		return true
	}
}


processes.TemporaryMemory = class{
	things = []
	tick(){
		for(let t of this.things){
			t.charge -= 0.01
			if(t.charge <= 0) this.things.delete(t)
		}
	}
	add(newOne, equals, charge = 1){
		newOne.charge = charge
		newOne.equals = equals
		for(let i=0; i<this.things.length; i++){
			if(newOne.equals === this.things[i].equals && newOne.equals(newOne,this.things[i])){
				this.things[i] = newOne
				return
			}
		}
		this.things.push(newOne)
	}
}

processes.QuickNetwork = class{
	static node = class{
		charge = 0
		input = 0
		strength = 1
		next = []
		tick(){
			let rounded = this.charge > 0.5
			if(rounded){
				this.strength += (1-this.strength)*0.1
				for(let i=0;i<this.next.length;i++){
					this.next[i].input += this.strength
				}
			}else{
				this.strength *= 0.99
			}
		}
		updateCharge(){
			this.charge = this.input
			this.input = 0
		}
	}
	inputs = []
	outputs = []
	nodes = []
	constructor(superProcess){
		let n
		n = this.inputs[0] = this.newNode()
		n.next.push(n = this.newNode())
		n.next.push(n = this.newNode())
		this.outputs[0] = n
	}
	newNode(){
		let n = new this.constructor.node()
		this.nodes.push(n)
		return n
	}
	tick(){
		this.inputs[0].input+=this.superProcess.input1

		for(let i=0;i<this.nodes.length;i++) this.nodes[i].tick()
		for(let i=0;i<this.nodes.length;i++) this.nodes[i].updateCharge()

		this.superProcess.output1=this.outputs[0].charge>0.5?1:0
	}
}

processes.CauseEffectFinder = class{
	tick(){
		
	}
}

class SuperProcess{
	constructor(){
		this.input1 = 0
		this.output1 = 0

		this.processes = []
		this.processesMap = {}
		for(let p in processes){
			let realP = new processes[p](this)
			realP.superProcess = this
			this.this.processes.push(realP)
			this.processesMap[p] = realP
		}

		this.curId = 0
	}
	generateID(){return this.curId++}
	tick(){
		for(let i=0; i<this.processes.length; i++){
			this.processes[i].tick()
		}
	}
}

let thing=new SuperProcess()
function tickLoop(){
	thing.tick()
	console.log(thing.output1)

	setTimeout(tickLoop,1000)
}
tickLoop()

var readline = require('readline');

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY)
    process.stdin.setRawMode(true);

console.log('press q to exit, or any key to print log');

process.stdin.on('keypress', (chunk, key) => {
	if(!key)return
  switch(key.name){
    case "q":process.exit();break
    case "a":thing.input1=1;break
    case "backspace":thing.input1=0;break
  }
});