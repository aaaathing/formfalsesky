package main

import (
	"fmt"
	"time"

	"cogentcore.org/core/math32"
	"cogentcore.org/core/tensor"
	"github.com/emer/emergent/v2/egui"
	"github.com/emer/emergent/v2/emer"
	"github.com/emer/emergent/v2/etime"
	"github.com/emer/emergent/v2/netview"
	"github.com/emer/emergent/v2/params"
	"github.com/emer/emergent/v2/paths"
	"github.com/emer/leabra/v2/leabra"
)

const useGUI = true

var Net *leabra.Network
var Params = new(emer.NetParams)
var GUI = new(egui.GUI)
var ViewUpdate = new(netview.ViewUpdate)

// ParamSets is the default set of parameters.
// Base is always applied, and others can be optionally
// selected to apply on top of that.
var ParamSets = params.Sets{
	"Base": {
		{Sel: "Path", Desc: "norm and momentum on works better, but wt bal is not better for smaller nets",
			Params: params.Params{
				"Path.Learn.Norm.On":     "true",
				"Path.Learn.Momentum.On": "true",
				"Path.Learn.WtBal.On":    "true", // no diff really
				// "Path.Learn.WtBal.Targs": "true", // no diff here
			}},
		{Sel: "Layer", Desc: "using default 1.8 inhib for all of network -- can explore",
			Params: params.Params{
				"Layer.Inhib.Layer.Gi": "1.8",
				"Layer.Act.Init.Decay": "0.0",
				"Layer.Act.Gbar.L":     "0.1", // set explictly, new default, a bit better vs 0.2
			}},
		{Sel: ".BackPath", Desc: "top-down back-pathways MUST have lower relative weight scale, otherwise network hallucinates",
			Params: params.Params{
				"Path.WtScale.Rel": "0.2",
			}},
		{Sel: "#Output", Desc: "output definitely needs lower inhib -- true for smaller layers in general",
			Params: params.Params{
				"Layer.Inhib.Layer.Gi": "1.4",
			}},
	},
	"DefaultInhib": {
		{Sel: "#Output", Desc: "go back to default",
			Params: params.Params{
				"Layer.Inhib.Layer.Gi": "1.8",
			}},
	},
	"NoMomentum": {
		{Sel: "Path", Desc: "no norm or momentum",
			Params: params.Params{
				"Path.Learn.Norm.On":     "false",
				"Path.Learn.Momentum.On": "false",
			}},
	},
	"WtBalOn": {
		{Sel: "Path", Desc: "weight bal on",
			Params: params.Params{
				"Path.Learn.WtBal.On": "true",
			}},
	},
}

func initIt() {
	Net = leabra.NewNetwork("thestuff")

	Net.SetRandSeed(0) // init new separate random seed, using run = 0

	inp := Net.AddLayer2D("Input", 2, 2, leabra.InputLayer)
	hid1 := Net.AddLayer2D("Hidden1", 5, 5, leabra.SuperLayer)
	hid1.AsEmer().PlaceRightOf(inp, 1)
	hid2 := Net.AddLayer2D("Hidden2", 5, 5, leabra.SuperLayer)
	hid2.PlaceRightOf(hid1, 1)
	out := Net.AddLayer2D("Output", 2, 2, leabra.TargetLayer)
	out.PlaceRightOf(hid2, 1)

	// use this to position layers relative to each other
	// hid2.PlaceRightOf(hid1, 2)

	// note: see emergent/path module for all the options on how to connect
	// NewFull returns a new paths.Full connectivity pattern
	full := paths.NewFull()

	Net.ConnectLayers(inp, hid1, full, leabra.ForwardPath)
	Net.BidirConnectLayers(hid1, hid2, full)
	Net.BidirConnectLayers(hid2, out, full)

	// Net.LateralConnectLayerPath(hid1, full, &leabra.HebbPath{}).SetType(InhibPath)

	// note: if you wanted to change a layer type from e.g., Target to Compare, do this:
	// out.SetType(emer.Compare)
	// that would mean that the output layer doesn't reflect target values in plus phase
	// and thus removes error-driven learning -- but stats are still computed.

	Params.Config(ParamSets, "", "", Net)

	Net.Build()
	Net.Defaults()
	Params.SetAll()
	/*if Config.Params.Network != nil {
		Params.SetNetworkMap(Net, Config.Params.Network)
	}*/
	Net.InitWeights()

	if useGUI {
		GUI.MakeBody(nil, "thestuff", "thestuff", `it does stuff`)

		nv := GUI.AddNetView("Network")
		nv.Options.MaxRecs = 300
		nv.SetNet(Net)
		ViewUpdate.Config(nv, etime.AlphaCycle, etime.AlphaCycle)
		GUI.ViewUpdate = ViewUpdate

		nv.SceneXYZ().Camera.Pose.Pos.Set(0, 2, 2) // more "head on" than default which is more "top down"
		nv.SceneXYZ().Camera.LookAt(math32.Vec3(0, 0, 0), math32.Vec3(0, 1, 0))

		GUI.FinalizeGUI(false)
	}
}

/*
// Save weights to file, to look at later
ls.Loop(etime.Train, etime.Run).OnEnd.Add("SaveWeights", func() {
	ctrString := ss.Stats.PrintValues([]string{"Run", "Epoch"}, []string{"%03d", "%05d"}, "_")
	leabra.SaveWeightsIfConfigSet(ss.Net, ss.Config.Log.SaveWeights, ctrString, ss.Stats.String("RunName"))
})
*/

func input() {
	var pats = tensor.New[float32]([]int{2, 2})
	pats.SetFloats([]float64{1, 0, 0, 1})
	var opats = tensor.New[float32]([]int{2, 2})
	opats.SetFloats([]float64{0, 0, 0, 0})

	Net.InitExt()
	Net.LayerByName("Input").ApplyExt(pats)
	Net.LayerByName("Output").ApplyExt(opats)
}

var ctx = leabra.NewContext()

func loop() {
	ctx.Mode = etime.Train
	input()
	Net.Cycle(ctx)
	Net.DWt()
	if useGUI {
		ViewUpdate.RecordSyns()
	}
	Net.WtFromDWt()

	ctx.CycleInc()
	if ctx.Cycle == 0 || ctx.Cycle == 100 {
		ctx.AlphaCycStart()
		Net.AlphaCycInit(true)
		ctx.PlusPhase = false
	}
	if ctx.Cycle == 0 || ctx.Cycle == 25 || ctx.Cycle == 50 || ctx.Cycle == 75 {
		Net.QuarterFinal(ctx)
		ctx.QuarterInc()
	}
	if ctx.Cycle == 75 {
		ctx.PlusPhase = true
	}

	if useGUI {
		ViewUpdate.GoUpdate()
		ViewUpdate.Text = fmt.Sprintf("cycle %d", ctx.Cycle)
	}
}

func doLoop() {
	for {
		loop()
		time.Sleep(time.Second / 10)
	}
}
func main() {
	initIt()
	println("init")
	if useGUI {
		go doLoop()
		GUI.Body.RunMainWindow()
	} else {
		doLoop()
	}
}
