package main

import (
	/*"github.com/emer/emergent/v2/econfig"
	"github.com/emer/emergent/v2/egui"
	"github.com/emer/emergent/v2/elog"
	"github.com/emer/emergent/v2/env"
	"github.com/emer/emergent/v2/estats"
	"github.com/emer/emergent/v2/etime"
	"github.com/emer/emergent/v2/looper"
	"github.com/emer/emergent/v2/netview"
	"github.com/emer/emergent/v2/patgen"*/
	"cogentcore.org/core/tensor"
	"github.com/emer/emergent/v2/emer"
	"github.com/emer/emergent/v2/etime"
	"github.com/emer/emergent/v2/params"
	"github.com/emer/emergent/v2/paths"
	"github.com/emer/leabra/v2/leabra"
)

var Net *leabra.Network
var Params *emer.NetParams
var pats tensor.Tensor

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

func stuff() {
	Net = leabra.NewNetwork("thestuff")

	Net.SetRandSeed(0) // init new separate random seed, using run = 0

	inp := Net.AddLayer2D("Input", 2, 2, leabra.InputLayer)
	inp.Doc = "Input represents sensory input, coming into the cortex via tha thalamus"
	hid1 := Net.AddLayer2D("Hidden1", 5, 5, leabra.SuperLayer)
	hid1.Doc = "First hidden layer performs initial internal processing of sensory inputs, transforming in preparation for producing appropriate responses"
	hid2 := Net.AddLayer2D("Hidden2", 5, 5, leabra.SuperLayer)
	hid2.Doc = "Another 'deep' layer of internal processing to prepare directly for Output response"
	out := Net.AddLayer2D("Output", 2, 2, leabra.TargetLayer)
	out.Doc = "Output represents motor output response, via deep layer 5 neurons projecting supcortically, in motor cortex"

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

	Params = new(emer.NetParams)

	Params.Config(ParamSets, "", "", Net)

	Net.Build()
	Net.Defaults()
	Params.SetAll()
	/*if Config.Params.Network != nil {
		Params.SetNetworkMap(Net, Config.Params.Network)
	}*/
	Net.InitWeights()
}

/*
// Save weights to file, to look at later
ls.Loop(etime.Train, etime.Run).OnEnd.Add("SaveWeights", func() {
	ctrString := ss.Stats.PrintValues([]string{"Run", "Epoch"}, []string{"%03d", "%05d"}, "_")
	leabra.SaveWeightsIfConfigSet(ss.Net, ss.Config.Log.SaveWeights, ctrString, ss.Stats.String("RunName"))
})
*/

func input() {
	lays := Net.LayersByType(leabra.InputLayer, leabra.TargetLayer)
	Net.InitExt()
	for _, lnm := range lays {
		ly := Net.LayerByName(lnm)
		if pats != nil {
			ly.ApplyExt(pats)
		}
	}
}

var ctx = leabra.NewContext()

func loop() {
	ctx.Mode = etime.Train
	input()
	Net.Cycle(ctx)
	ctx.CycleInc()
	Net.DWt()
	Net.WtFromDWt()
}

func main() {
	stuff()
	pats = tensor.New[float32]([]int{5, 5})
	pats.SetFloats([]float64{1, 0, 0, 1})

	loop()
}
