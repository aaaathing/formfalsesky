const gui = require('gui')

const win = gui.Window.create({})

const mainContainer = gui.Container.create()
mainContainer.setStyle({flexDirection: 'row'})
win.setContentView(mainContainer)

const sidebar = gui.Container.create()
sidebar.setStyle({padding: 16})
mainContainer.addChildView(sidebar)


const net = new (require("./networks.js")).Network()
let inp=[], outp=[]
let inply = net.addLayer({w0:3,type:"input",inputObj:inp,inhibGainForLayer:0})
let outly = net.addLayer({w0:3,type:"target",inputObj:outp})
let pt=net.addPath({sender:inply,reciever:outly})
inp.splice(0,inp.length, 1,0,0)
outp.splice(0,outp.length, 0,1,0)

const save = gui.Button.create('')
save.setTitle("do it (tick)")
save.onClick = () => {
	net.tick()
	for(let i of allShowers) i.schedulePaint()
}
sidebar.addChildView(save)

let showProp = "Act"
let showPropPicker = gui.Picker.create('')
showPropPicker.addItem("Act")
showPropPicker.addItem("Ge")
showPropPicker.addItem("Gi")
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

let allShowers = []
function addShower(l, name){
	let text = gui.Label.createWithAttributedText(gui.AttributedText.create(name, {color:"#000"}))
	text.setStyle({alignSelf: 'center'})
	scrollArea.addChildView(text)
	const showContainer = gui.Container.create()
	const scale = 50
	showContainer.setStyle({width:l.w0*l.w2*scale, height:l.w1*l.w3*scale, marginBottom:32, alignSelf: 'center'})
	scrollArea.addChildView(showContainer)
	/** @param {gui.Painter} ctx */
	showContainer.onDraw = (self, ctx) => {
		// Draw the shadow of heart.
		for(let x=0;x<l.w0;x++) for(let y=0;y<l.w1;y++) for(let z=0;z<l.w2;z++) for(let w=0;w<l.w3;w++){
			let n = l.getNode(x,y,z,w)
			let value
			switch(showProp){
				case "Act":value=n.Act;break
				case "Ge":value=n.Ge;break
				case "Gi":value=n.Gi;break
			}
			ctx.setFillColor(gui.Color.rgb(value*255,value*255,0))
			ctx.fillRect({x:(x*l.w2+z)*scale, y:(y*l.w3+w)*scale, width:scale,height:scale})
		}
	}
	allShowers.push(showContainer)
}
addShower(inply, "input")
addShower(outly, "output")


win.onClose = () => gui.MessageLoop.quit()
win.setContentSize({width: 400, height: 400})
win.maximize()
win.center()

win.activate()

if (!process.versions.yode && !process.versions.electron) {
  gui.MessageLoop.run()  // block until gui.MessageLoop.quit() is called
  process.exit(0)
}
