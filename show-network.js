const gui = require('gui')

const win = gui.Window.create({})

const mainContainer = gui.Container.create()
mainContainer.setStyle({flexDirection: 'row'})
win.setContentView(mainContainer)

const sidebar = gui.Container.create()
sidebar.setStyle({padding: 16})
mainContainer.addChildView(sidebar)

const font = gui.Font.create("", 24, "normal", "normal")

const net = new (require("./networks.js")).Network()
let inp=[], outp=[]
let inply = net.addLayer({name:"inply",w0:3,type:"input",inputObj:inp,inhibGainForLayer:0})
//let hidly = net.addLayer({name:"hidly",w0:3,type:"super"})
let outly = net.addLayer({name:"outly",w0:3,type:"target",inputObj:outp})
//net.addPath({sender:inply,reciever:hidly})
net.addPath({sender:inply,reciever:outly})
inp.splice(0,inp.length, 1,0,0)
outp.splice(0,outp.length, 0,1,0)

const save = gui.Button.create('')
save.setFont(font)
save.setTitle("do it (tick)")
save.onClick = () => {
	net.tick()
	for(let i of allShowers) i.schedulePaint()
}
sidebar.addChildView(save)

let showProp = "Act"
let showPropPicker = gui.Picker.create('')
showPropPicker.setFont(font)
showPropPicker.addItem("Act")
showPropPicker.addItem("Ge")
showPropPicker.addItem("Gi")
showPropPicker.addItem("reciever Wt")
showPropPicker.addItem("sender Wt")
sidebar.addChildView(showPropPicker)
showPropPicker.onSelectionChange = () => {
	showProp = showPropPicker.getSelectedItem()
	for(let i of allShowers) i.schedulePaint()
}

const scroll = gui.Scroll.create()
const scrollArea = gui.Container.create()
scrollArea.setBackgroundColor("#aaa")
scroll.setContentView(scrollArea)
scroll.setStyle({flex: 1})
mainContainer.addChildView(scroll)

let selectedNode, selectedNodeLayer, selectedNodeIndex
let allShowers = []
function addShower(l){
	let text = gui.Label.createWithAttributedText(gui.AttributedText.create(l.name, {color:"#000",font}))
	text.setStyle({alignSelf: 'center'})
	scrollArea.addChildView(text)
	const showContainer = gui.Container.create()
	const scale = 50
	showContainer.setStyle({width:l.w0*l.w2*scale, height:l.w1*l.w3*scale, marginBottom:32, alignSelf: 'center'})
	scrollArea.addChildView(showContainer)
	/** @param {gui.Painter} ctx */
	showContainer.onDraw = (self, ctx) => {
		showContainer.setTooltip("")
		for(let x=0;x<l.w0;x++) for(let y=0;y<l.w1;y++) for(let z=0;z<l.w2;z++) for(let w=0;w<l.w3;w++){
			let n = l.getNode(x,y,z,w)
			let rect = {x:(x*l.w2+z)*scale, y:(y*l.w3+w)*scale, width:scale,height:scale}
			let value
			switch(showProp){
				case "Act":value=n.Act;break
				case "Ge":value=n.Ge;break
				case "Gi":value=n.Gi;break
				case "reciever Wt":
					value = net.getRecieverOfNodeInThisLayer(selectedNodeIndex,selectedNodeLayer,l,l.getNodeIndex(x,y,z,w))?.Wt
					break
				case "sender Wt":
					value = net.getSenderOfNodeInThisNode(selectedNodeIndex,selectedNodeLayer,l,l.getNodeIndex(x,y,z,w))?.Wt
					break
			}
			ctx.setFillColor(gui.Color.rgb(value*255,value*255,0))
			ctx.fillRect(rect)

			if(n === selectedNode){
				ctx.setStrokeColor(gui.Color.rgb(127,127,255))
				ctx.setLineWidth(4)
				ctx.strokeRect(rect)
				showContainer.setTooltip("selected: "+value)
			}
		}
	}
	showContainer.onMouseUp = (self, event) => {
		const sx = event.positionInView.x/scale, sy = event.positionInView.y/scale
		selectedNodeIndex = l.getNodeIndex(Math.floor(sx/l.w2), Math.floor(sy/l.w3), Math.floor(sx%l.w2), Math.floor(sy%l.w3))
		selectedNode = l.nodes[selectedNodeIndex]
		selectedNodeLayer = l
		for(let i of allShowers) i.schedulePaint()
	}
	allShowers.push(showContainer)
}
for(let i of net.layers){
	addShower(i)
}


win.onClose = () => gui.MessageLoop.quit()
win.setContentSize({width: 400, height: 400})
win.maximize()
win.center()

win.activate()

if (!process.versions.yode && !process.versions.electron) {
  gui.MessageLoop.run()  // block until gui.MessageLoop.quit() is called
  process.exit(0)
}
