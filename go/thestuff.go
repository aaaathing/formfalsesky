package main

import (
	"github.com/emer/axon/v2/axon"
	"github.com/emer/emergent/v2/paths"
)

var net *axon.Network

func stuff() {
	net = axon.NewNetwork("thestuff")

	net.SetMaxData(ss.Config.Run.NData)
	net.SetRandSeed(ss.RandSeeds[0]) // init new separate random seed, using run = 0

	inp := net.AddLayer2D("Input", axon.InputLayer, 5, 5)
	hid1 := net.AddLayer2D("Hidden1", axon.SuperLayer, ss.Config.Params.Hidden1Size.Y, ss.Config.Params.Hidden1Size.X)
	hid2 := net.AddLayer2D("Hidden2", axon.SuperLayer, ss.Config.Params.Hidden2Size.Y, ss.Config.Params.Hidden2Size.X)
	out := net.AddLayer2D("Output", axon.TargetLayer, 5, 5)

	// use this to position layers relative to each other
	// hid2.PlaceRightOf(hid1, 2)

	// note: see emergent/path module for all the options on how to connect
	// NewFull returns a new paths.Full connectivity pattern
	full := paths.NewFull()

	net.ConnectLayers(inp, hid1, full, axon.ForwardPath)
	net.BidirConnectLayers(hid1, hid2, full)
	net.BidirConnectLayers(hid2, out, full)

	// net.LateralConnectLayerPath(hid1, full, &axon.HebbPath{}).SetType(InhibPath)

	// note: if you wanted to change a layer type from e.g., Target to Compare, do this:
	// out.Type = axon.CompareLayer
	// that would mean that the output layer doesn't reflect target values in plus phase
	// and thus removes error-driven learning -- but stats are still computed.

	net.Build()
	net.Defaults()
	net.SetNThreads(ss.Config.Run.NThreads)
	ss.ApplyParams()
	net.InitWeights()
}
