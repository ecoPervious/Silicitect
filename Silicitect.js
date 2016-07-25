// float arrays?
// reuse memory
// dynamic interrupts
// save/loading of models
// kill all function factories: rowPluck, matrix multiply in graph
// move matrix operations to matrix class
// add different cost functions than shannon entropy
// restructure classes
// optimise? extra matrix random method
// split the whole backward thingy

var temperature = 1.0;
var reguliser = 0.000001;
var learningRate = 0.02;
var clipValue = 5.0;
var hiddenSizes = [5, 5];
var letterEmbedSize = 5;
var decayRate = 0.97;

var text = "";
var inputSize = 0;
var outputSize = 0;
var letterToIndex = {};
var indexToLetter = [];
var model = {};
var lastWeights = {};
var characterSet = "predefined";

var characters = "!@#$%^&*()_+{}\":|?><~±§¡€£¢∞œŒ∑´®†¥øØπ∏¬˚∆åÅßΩéúíóáÉÚÍÓÁëüïöäËÜÏÖÄ⁄™‹›ﬁﬂ‡°·—±≈çÇ√-=[];'\,.\\/`~µ≤≥„‰◊ˆ˜¯˘¿—⁄\n\t1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function init (e) {
	
	text = e.responseText;
	
	indexToLetter[0] = "";
	
	if (characterSet == "predefined") {
		
		for (var a = 0; a < characters.length; a++) {
			
			if (letterToIndex[characters.charAt(a)]) continue;
			
			letterToIndex[characters.charAt(a)] = indexToLetter.length;
			indexToLetter[indexToLetter.length] = characters.charAt(a);
			
		}
		
		for (var a = 0; a < text.length; a++) {
			
			if (!letterToIndex[text.charAt(a)]) {
				
				console.log("Wrong character found, " + text.charAt(a) + " not in " + characterSet);
				return;
				
			}
			
		}
		
	} else if (characterSet == "analyse") {
		
		for (var a = 0; a < text.length; a++) {
			
			var char = text.charAt(a);
			
			if (letterToIndex[char]) continue;
			
			letterToIndex[char] = indexToLetter.length;
			indexToLetter[indexToLetter.length] = char;
			
		}
		
	} else {
		
		console.log("Wrong character set specified");
		return;
		
	}
	
	inputSize = indexToLetter.length + 1;
	outputSize = indexToLetter.length + 1;
	
	initModel("lstm");
	
	var sampleInterval = 50;
	var startTime = new Date();
	var averageTime = 0;
	
	for (var a = 0; a < 2000; a++) {
		
		pass(20);
		
		// Art.doWrite(0, ask(50));
		
		// console.log(a + 1, ask(50));
		if (a % sampleInterval == sampleInterval - 1) {
			
			averageTime += new Date() - startTime;
			
			console.log(a + 1, new Date() - startTime, ask(50, ""));
			
			startTime = new Date();
			
		}
		
	}
	
	console.log(averageTime / (a / sampleInterval));
	
}

function solve () {
	
	for (var a in model) {
		
		if (!lastWeights[a]) lastWeights[a] = new Matrix(model[a].n, model[a].d);
		
		var ma = model[a];
		var mb = lastWeights[a];
		
		for (var b = 0; b < ma.w.length; b++) {
			
			mb.w[b] = mb.w[b] * decayRate + (1 - decayRate) * ma.dw[b] * ma.dw[b];
			
			var clippedValue = Math.max(-clipValue, Math.min(clipValue, ma.dw[b]));
			
			ma.w[b] += -learningRate * clippedValue / Math.sqrt(mb.w[b] + 1e-8) - reguliser * ma.w[b];
			ma.dw[b] = 0;
			
		}
		
	}
	
}

function pass (batchSize) {
	
	var sentence = text.substr(Math.floor(Math.random() * (text.length - batchSize)), batchSize);
	var cost = computeCost(sentence);
	
	cost.graph.backward();
	
	solve();
	
}

function ask (length, prime) {
	
	var graph = new Graph(false);
	var sentence = prime;
	var log = 0;
	var previous = {};
	var forward = {};
	
	for (var a = 0; a < prime.length; a++) {
		
		var letter = letterToIndex[prime.charAt(a)];
		
		forward = forwardLSTM(graph, letter, previous);
		previous = forward;
		
	}
	
	for (var a = 0; a < length; a++) {
		
		var letter = sentence.length == 0 ? 0 : letterToIndex[sentence.charAt(sentence.length - 1)];
		
		forward = forwardLSTM(graph, letter, previous);
		previous = forward;
		
		for (var b = 0; b < forward.o.w.length; b++) {
			
			forward.o.w[b] /= temperature;
			
		}
		
		var probabilities = softmax(forward.o);
		var index = sampler(probabilities.w);
		
		sentence += indexToLetter[index];
		
	}
	
	return sentence.slice(prime.length);
	
}

function computeCost (sentence) {
	
	var graph = new Graph(true);
	var log = 0;
	var cost = 0;
	var previous = {};
	var forward = {};
	
	for (var a = -1; a < sentence.length; a++) {
		
		var letter = a == -1 ? 0 : letterToIndex[sentence.charAt(a)];
		var nextLetter = a == sentence.length - 1 ? 0 : letterToIndex[sentence.charAt(a + 1)];
		
		if (!(letter + 1)) {
			
			console.log("Found unkown character: " + sentence.charAt(a));
			break;
			
		}
		
		forward = forwardLSTM(graph, letter, previous);
		previous = forward;
		
		var probabilities = softmax(forward.o);
		
		log -= Math.log2(probabilities.w[nextLetter]);
		cost -= Math.log(probabilities.w[nextLetter]);
		
		forward.o.dw = probabilities.w;
		forward.o.dw[nextLetter] -= 1;
		
	}
	
	return {"graph":graph, "ppl":Math.pow(2, log / (sentence.length - 1)), "cost":cost};
	
}

function forwardRNN (letter, previous) {
	
	var observation = graph.rowPluck(model["Wil"], letter);
	var hiddenPrevious = [];
	
	if (previous.h) {
		
		hiddenPrevious = previous.h;
		
	} else {
		
		for (var a = 0; a < hiddenSizes.length; a++) {
			
			hiddenPrevious.push(new Matrix(hiddenSizes[a], 1));
			
		}
		
	}
	
	var hidden = [];
	
	for (var a = 0; a < hiddenSizes.length; a++) {
		
		var input = a == 0 ? observation : hidden[a - 1];
		
		var h0 = graph.multiply(model["Wxh" + a], input);
		var h1 = graph.multiply(model["Whh" + a], hiddenPrevious[a]);
		var hiddenValue = graph.rectifier(graph.add(graph.add(h0, h1), model["bhh" + a]));
		
		hidden.push(hiddenValue);
		
	}
	
	var output = graph.add(graph.multiply(model["Whd"], hidden[hidden.length - 1]), model["bd"]);
	
	return {"h":hidden, "o":output};
	
}

function forwardLSTM (graph, letter, previous) {
	
	var observation = graph.rowPluck(model["Wil"], letter);
	var hiddenPrevious = [];
	var cellPrevious = [];
	
	if (previous.h) {
		
		hiddenPrevious = previous.h;
		cellPrevious = previous.c;
		
	} else {
		
		for (var a = 0; a < hiddenSizes.length; a++) {
			
			hiddenPrevious.push(new Matrix(hiddenSizes[a], 1));
			cellPrevious.push(new Matrix(hiddenSizes[a], 1));
			
		}
		
	}
	
	var hidden = [];
	var cell = [];
	
	for (var a = 0; a < hiddenSizes.length; a++) {
		
		var input = a == 0 ? observation : hidden[a - 1];
		
		var h0 = graph.multiply(model["Wix" + a], input);
		var h1 = graph.multiply(model["Wih" + a], hiddenPrevious[a]);
		var inputGate = graph.sigmoid(graph.add(graph.add(h0, h1), model["bi" + a]));
		
		var h2 = graph.multiply(model["Wfx" + a], input);
		var h3 = graph.multiply(model["Wfh" + a], hiddenPrevious[a]);
		var forgetGate = graph.sigmoid(graph.add(graph.add(h2, h3), model["bf" + a]));
		
		var h4 = graph.multiply(model["Wox" + a], input);
		var h5 = graph.multiply(model["Woh" + a], hiddenPrevious[a]);
		var outputGate = graph.sigmoid(graph.add(graph.add(h4, h5), model["bo" + a]));
		
		var h6 = graph.multiply(model["Wcx" + a], input);
		var h7 = graph.multiply(model["Wch" + a], hiddenPrevious[a]);
		var cellWrite = graph.hyperbolicTangent(graph.add(graph.add(h6, h7), model["bc" + a]));
		
		var retain = graph.feedlessMultiply(forgetGate, cellPrevious[a]);
		var write = graph.feedlessMultiply(inputGate, cellWrite);
		
		var cellValue = graph.add(retain, write);
		var hiddenValue = graph.feedlessMultiply(outputGate, graph.hyperbolicTangent(cellValue));
		
		hidden.push(hiddenValue);
		cell.push(cellValue);
		
	}
	
	var output = graph.add(graph.multiply(model["Whd"], hidden[hidden.length - 1]), model["bd"]);
	
	return {"h":hidden, "c":cell, "o":output};
	
}

function initModel (generator) {
	
	model = {"Wil":new RandomMatrix(inputSize, letterEmbedSize, 0, 0.08)};
	
	if (generator == "rnn") {
		
		for (var a = 0; a < hiddenSizes.length; a++) {
			
			var prevSize = a == 0 ? letterEmbedSize : hiddenSizes[a - 1];
			
			model["Wxh" + a] = new RandomMatrix(hiddenSizes[a], prevSize, 0, 0.08);
			model["Whh" + a] = new RandomMatrix(hiddenSizes[a], hiddenSizes[a], 0, 0.08);
			model["bhh" + a] = new Matrix(hiddenSizes[a], 1);
			
		}
		
		model["Whd"] = new RandomMatrix(outputSize, hiddenSizes[hiddenSizes.length - 1], 0, 0.08);
		model["bd"] = new Matrix(outputSize, 1);
		
	} else if (generator == "lstm") {
		
		for (var a = 0; a < hiddenSizes.length; a++) {
			
			var prevSize = a == 0 ? letterEmbedSize : hiddenSizes[a - 1];
			
			model['Wix' + a] = new RandomMatrix(hiddenSizes[a], prevSize, 0, 0.08);
			model['Wih' + a] = new RandomMatrix(hiddenSizes[a], hiddenSizes[a], 0, 0.08);
			model['bi' + a] = new Matrix(hiddenSizes[a], 1);
			
			model['Wfx' + a] = new RandomMatrix(hiddenSizes[a], prevSize, 0, 0.08);
			model['Wfh' + a] = new RandomMatrix(hiddenSizes[a], hiddenSizes[a], 0, 0.08);
			model['bf' + a] = new Matrix(hiddenSizes[a], 1);
			
			model['Wox' + a] = new RandomMatrix(hiddenSizes[a], prevSize, 0, 0.08);
			model['Woh' + a] = new RandomMatrix(hiddenSizes[a], hiddenSizes[a], 0, 0.08);
			model['bo' + a] = new Matrix(hiddenSizes[a], 1);
			
			model['Wcx' + a] = new RandomMatrix(hiddenSizes[a], prevSize, 0, 0.08);
			model['Wch' + a] = new RandomMatrix(hiddenSizes[a], hiddenSizes[a], 0, 0.08);
			model['bc' + a] = new Matrix(hiddenSizes[a], 1);
			
		}
		
		model["Whd"] = new RandomMatrix(outputSize, hiddenSizes[hiddenSizes.length - 1], 0, 0.08);
		model["bd"] = new Matrix(outputSize, 1);
		
	}
	
}

function softmax (ma) {
	
	var out = new Matrix(ma.n, ma.d);
	var max = -1e10;
	var sum = 0;
	
	for (var a = 0; a < ma.w.length; a++) {
		
		if (ma.w[a] > max) max = ma.w[a];
		
	}
	
	for (var a = 0; a < ma.w.length; a++) {
		
		out.w[a] = Math.exp(ma.w[a] - max);
		
		sum += out.w[a];
		
	}
	
	for (var a = 0; a < ma.w.length; a++) {
		
		out.w[a] /= sum;
		
	}
	
	return out;
	
}

function sampler (w) {
	
	var random = Math.random();
	var sum = 0;
	
	for (var a = 0; a < w.length; a++) {
		
		sum += w[a];
		
		if (sum > random) return a;
		
	}
	
	return a.length - 1;
	
}

Stecy.setup = function () {
	
	Art.title = "Silicitect";
	
};

Art.ready = function () {
	
	Stecy.loadFile("input/simple.txt", init);
	
	Art.doStyle(0, "whiteSpace", "pre");
	
};

(function () {
	
	
	Matrix = function (n, d) {
		
		this.n = n;
		this.d = d;
		this.w = [];
		this.dw = [];
		
		for (var a = 0; a < n * d; a++) {
			
			this.w[a] = 0;
			this.dw[a] = 0;
			
		}
		
	};
	
	RandomMatrix = function (n, d, base, range) {
		
		this.n = n;
		this.d = d;
		this.w = [];
		this.dw = [];
		
		for (var a = 0; a < n * d; a++) {
			
			this.w[a] = base + range * Math.random();
			this.dw[a] = 0;
			
		}
		
	};
	
	Graph = function (needsBackprop) {
		
		this.needsBackprop = needsBackprop;
		this.backprop = [];
		
	};
	
	Graph.prototype.backward = function () {
		
		for (var a = this.backprop.length - 1; a > -1; a--) {
			
			this.backprop[a]();
			
		}
		
	};
	
	Graph.prototype.multiply = function (ma, mb) {
		
		if (ma.d != mb.n) throw new Error("wrong dimensions");
		
		var out = new Matrix(ma.n, mb.d);
		
		for (var a = 0; a < ma.n; a++) {
			
			for (var b = 0; b < mb.d; b++) {
				
				out.w[mb.d * a + b] = 0;
				
				for (var c = 0; c < ma.d; c++) {
					
					out.w[mb.d * a + b] += ma.w[ma.d * a + c] * mb.w[mb.d * c + b];
					
				}
				
			}
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.n; a++) {
					
					for (var b = 0; b < mb.d; b++) {
						
						for (var c = 0; c < ma.d; c++) {
							
							ma.dw[ma.d * a + c] += mb.w[mb.d * c + b] * out.dw[mb.d * a + b];
							mb.dw[mb.d * c + b] += ma.w[ma.d * a + c] * out.dw[mb.d * a + b];
							
						}
						
					}
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.feedlessMultiply = function (ma, mb) {
		
		var out = new Matrix(ma.n, ma.d);
		
		for (var a = 0; a < ma.w.length; a++) {
			
			out.w[a] = ma.w[a] * mb.w[a];
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.w.length; a++) {
					
					ma.dw[a] += mb.w[a] * out.dw[a];
					mb.dw[a] += ma.w[a] * out.dw[a];
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.add = function (ma, mb) {
		
		var out = new Matrix(ma.n, ma.d);
		
		for (var a = 0; a < ma.w.length; a++) {
			
			out.w[a] = ma.w[a] + mb.w[a];
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.w.length; a++) {
					
					ma.dw[a] += out.dw[a];
					mb.dw[a] += out.dw[a];
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.sigmoid = function (ma) {
		
		var out = new Matrix(ma.n, ma.d);
		
		for (var a = 0; a < ma.w.length; a++) {
			
			out.w[a] = 1 / (1 + Math.exp(-ma.w[a]));
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.w.length; a++) {
					
					ma.dw[a] += out.w[a] * (1 - out.w[a]) * out.dw[a];
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.rectifier = function (ma) {
		
		var out = new Matrix(ma.n, ma.d);
		
		for (var a = 0; a < ma.w.length; a++) {
			
			out.w[a] = Math.max(0, ma.w[a]);
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.w.length; a++) {
					
					ma.dw[a] += ma.w[a] > 0 ? out.dw[a] : 0;
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.hyperbolicTangent = function (ma) {
		
		var out = new Matrix(ma.n, ma.d);
		
		for (var a = 0; a < ma.w.length; a++) {
			
			out.w[a] = Math.tanh(ma.w[a]);
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.w.length; a++) {
					
					ma.dw[a] += (1 - out.w[a] * out.w[a]) * out.dw[a];
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
	Graph.prototype.rowPluck = function (ma, row) {
		
		var out = new Matrix(ma.d, 1);
		
		for (var a = 0; a < ma.d; a++) {
			
			out.w[a] = ma.w[ma.d * row + a];
			
		}
		
		if (this.needsBackprop) {
			
			var backward = function () {
				
				for (var a = 0; a < ma.d; a++) {
					
					ma.dw[ma.d * row + a] += out.dw[a];
					
				}
				
			};
			
			this.backprop.push(backward);
			
		}
		
		return out;
		
	};
	
})();