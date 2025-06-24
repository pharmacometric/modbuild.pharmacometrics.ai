/**
 * @file custom-func.js
 * @description Main application logic that connects the UI to the drawing and code generation libraries.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element References ---
    const modelTypeSelect = document.getElementById('model-type-select');
    const modelStructureControls = document.getElementById('model-structure-controls');
    const drawButton = document.getElementById('draw-button');
    const mainCanvas = document.getElementById('main-canvas');
    const plotCanvas = document.getElementById('plot-canvas');
    const plotScaleSelect = document.getElementById('plot-scale-select');
    const diagramSettingsPanel = document.getElementById('diagram-settings-panel');
    const plotSettingsPanel = document.getElementById('plot-settings-panel');
    const selectedModelPanel = document.getElementById('selected-model-panel');
    const canvasWidthInput = document.getElementById('canvas-width-input');
    const canvasHeightInput = document.getElementById('canvas-height-input');
    const imageScaleInput = document.getElementById('image-scale-input');
    const outputDimensionsPreview = document.getElementById('output-dimensions-preview');
    const downloadDiagramButton = document.getElementById('download-diagram-button');
    const downloadPlotButton = document.getElementById('download-plot-button');
    const downloadCodeButton = document.getElementById('download-code-button');
    const downloadNonmemButton = document.getElementById('download-nonmem-button');
    const downloadMonolixButton = document.getElementById('download-monolix-button');
    const downloadRButton = document.getElementById('download-r-button');
    
    const graph = new PharmaGraph('main-canvas', 'plot-canvas');
    const defaultLabels = { 
        ka: 'kₐ', ktr: 'Ktr', mtt: 'MTT = (N+1)/Ktr', k10: 'k₁₀', kel: 'Kₑₗ', k12: 'K₁₂', k21: 'K₂₁', k13: 'K₁₃', k31: 'K₃₁', iv: 'IV Dose',
        kon: 'Kₒₙ', koff: 'Kₒﬀ', kint: 'Kᵢₙₜ', ksyn: 'Kₛᵧₙ', kdeg: 'Kₔₑ₉'
    };
    const defaultCompData = {
        ka:{t:'Absorption',c:'#D3E4CD'}, c1:{t:'Central C₁',c:'#FDFD96'}, c2:{t:'Peripheral C₂',c:'#C8E6C9'}, c3:{t:'Peripheral C₃',c:'#B2DFDB'},
        rec:{t:'Receptor', c:'#D1C4E9'}, comp:{t:'LR Complex', c:'#F8BBD0'}
    };

    // --- UI & Control Functions ---
    const setupTabs = () => {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');
        const defaultTabButton = document.querySelector('[data-tab="selected-model"]');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => {
                    btn.classList.remove('border-blue-500', 'text-blue-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                button.classList.add('border-blue-500', 'text-blue-600');
                button.classList.remove('border-transparent', 'text-gray-500');
                tabPanels.forEach(panel => panel.classList.add('hidden'));
                document.getElementById(`${button.dataset.tab}-panel`).classList.remove('hidden');
            });
        });
        if(defaultTabButton) defaultTabButton.click();
    };
    
    const updateModelStructureControls = () => {
        const modelType = modelTypeSelect.value;
        modelStructureControls.innerHTML = '';
        if (modelType === 'tmdd') {
            modelStructureControls.innerHTML = `<div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-semibold text-slate-600 mb-1">PK Structure</label><select id="pk-comp-select" class="w-full text-sm rounded-md border-slate-300"><option value="1">1-Comp</option><option value="2" selected>2-Comp</option></select></div>
                    <div><label class="block text-sm font-semibold text-slate-600 mb-1">PK Administration</label><select id="pk-admin-select" class="w-full text-sm rounded-md border-slate-300"><option value="iv">IV Bolus</option><option value="oral">Oral (1st Order)</option><option value="transit">Oral (Transit)</option></select></div>
                </div>`;
        } else { // Standard PK
            modelStructureControls.innerHTML = `<div class="grid grid-cols-2 gap-4">
                    <div><label for="compartment-select" class="block text-sm font-semibold text-slate-600 mb-1">Compartments</label><select id="compartment-select" class="w-full text-sm rounded-md border-slate-300"><option value="1">1-Comp</option><option value="2" selected>2-Comp</option><option value="3">3-Comp</option></select></div>
                    <div><label for="admin-select" class="block text-sm font-semibold text-slate-600 mb-1">Administration</label><select id="admin-select" class="w-full text-sm rounded-md border-slate-300"><option value="iv">IV Bolus</option><option value="oral">Oral (1st Order)</option><option value="transit">Oral (Transit)</option></select></div>
                </div>`;
        }
        modelStructureControls.querySelectorAll('select').forEach(el => el.addEventListener('change', () => { updateDiagramSettings(); drawDiagram(); }));
    };

    const populatePlotSettings = () => {
        plotSettingsPanel.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div class="space-y-3 col-span-2 border-b pb-4 mb-2">
                     <h4 class="font-semibold">Dosing Regimen</h4>
                     <div class="grid grid-cols-3 gap-2">
                        <label class="block text-sm">Amount:<input type="number" id="sim-dose" value="100" min="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label>
                        <label class="block text-sm">Doses:<input type="number" id="sim-num-doses" value="1" min="1" class="mt-1 w-full text-sm rounded-md border-slate-300"></label>
                        <label class="block text-sm">Interval (h):<input type="number" id="sim-interval" value="24" min="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label>
                     </div>
                </div>
                <div class="space-y-3"><h4 class="font-semibold mb-2">X-Axis</h4><label class="block text-sm">Title: <input type="text" id="plot-xtitle" value="Time" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Min: <input type="number" id="plot-xmin" value="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Max: <input type="number" id="plot-xmax" value="48" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Step: <input type="number" id="plot-xstep" value="10" min="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label></div>
                <div class="space-y-3"><h4 class="font-semibold mb-2">Y-Axis</h4><label class="block text-sm">Title: <input type="text" id="plot-ytitle" value="Concentration" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Min: <input type="number" id="plot-ymin" value="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Max: <input type="number" id="plot-ymax" value="5" class="mt-1 w-full text-sm rounded-md border-slate-300"></label><label class="block text-sm">Step: <input type="number" id="plot-ystep" value="1" min="0" class="mt-1 w-full text-sm rounded-md border-slate-300"></label></div>
                <div class="space-y-3 col-span-2 border-t pt-4 mt-2">
                    <h4 class="font-semibold mb-2">Plot Appearance</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-sm">Font Family:<select id="plot-font-family" class="mt-1 w-full text-sm rounded-md border-slate-300"><option>sans-serif</option><option>serif</option><option>monospace</option></select></label></div>
                        <div><label class="block text-sm">Font Color:<input type="color" id="plot-font-color" value="#333333" class="mt-1 w-full h-9 p-0 rounded-md"></label></div>
                        <div><label class="block text-sm">Title Font Size:<input type="number" id="plot-title-fontsize" value="14" min="8" class="mt-1 w-full text-sm rounded-md border-slate-300"></label></div>
                        <div><label class="block text-sm">Tick Font Size:<input type="number" id="plot-tick-fontsize" value="12" min="6" class="mt-1 w-full text-sm rounded-md border-slate-300"></label></div>
                        <div><label class="block text-sm">Line Color:<input type="color" id="plot-linecolor" value="#007bff" class="mt-1 w-full h-9 p-0 rounded-md"></label></div>
                    </div>
                     <div class="grid grid-cols-2 gap-4 mt-4">
                         <label class="block text-sm">Width (px):<input type="number" id="plot-width" value="700" min="200" step="10" class="mt-1 w-full text-sm rounded-md border-slate-300"></label>
                         <label class="block text-sm">Height (px):<input type="number" id="plot-height" value="300" min="200" step="10" class="mt-1 w-full text-sm rounded-md border-slate-300"></label>
                     </div>
                </div>
            </div>`;
        plotSettingsPanel.querySelectorAll('input, select').forEach(input => input.addEventListener('input', replotOnly));
        document.getElementById('plot-width').addEventListener('input', handlePlotCanvasResize);
        document.getElementById('plot-height').addEventListener('input', handlePlotCanvasResize);
    };

    const updateDiagramSettings = () => {
        diagramSettingsPanel.innerHTML = '';
        const modelType = modelTypeSelect.value;
        let labelsToShow = [], compsToShow = [];
        
        if (modelType === 'tmdd') {
            const pkComp = parseInt(document.getElementById('pk-comp-select')?.value, 10) || 2;
            const pkAdmin = document.getElementById('pk-admin-select')?.value || 'iv';
            labelsToShow = ['kel', 'kon', 'koff', 'ksyn', 'kdeg', 'kint'];
            compsToShow = ['c1', 'rec', 'comp'];
            if (pkAdmin !== 'iv') { labelsToShow.push('ka'); compsToShow.unshift('ka'); } 
            else { labelsToShow.push('iv'); }
            if (pkAdmin === 'transit') { labelsToShow.push('ktr', 'mtt'); }
            if (pkComp > 1) { labelsToShow.push('k12', 'k21'); compsToShow.push('c2'); }
        } else {
            const numComp = parseInt(document.getElementById('compartment-select')?.value, 10) || 2;
            const adminType = document.getElementById('admin-select')?.value || 'iv';
            labelsToShow = ['k10']; compsToShow = ['c1'];
            if (numComp >= 2) { labelsToShow.push('k12', 'k21'); compsToShow.push('c2'); }
            if (numComp >= 3) { labelsToShow.push('k13', 'k31'); compsToShow.push('c3'); }
            if (adminType === 'oral') { labelsToShow.push('ka'); compsToShow.unshift('ka'); }
            else if (adminType === 'transit') { labelsToShow.push('ktr', 'mtt'); }
            else { labelsToShow.push('iv'); }
        }

        const styleSection = document.createElement('div');
        styleSection.innerHTML = `<h3 class="text-lg font-semibold text-slate-700 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-palette text-indigo-500"></i><span>Global Style</span></h3><div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="shape-select" class="text-sm font-semibold text-slate-600 text-right">Comp. Shape:</label><select id="shape-select" class="w-full text-sm rounded-md border-slate-300"><option value="rectangle" selected>Rectangle</option><option value="circle">Circle</option></select></div><div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="font-family-select" class="text-sm font-semibold text-slate-600 text-right">Font Family:</label><select id="font-family-select" class="w-full text-sm rounded-md border-slate-300"><option>sans-serif</option><option>serif</option><option>monospace</option></select></div><div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="font-size-input" class="text-sm font-semibold text-slate-600 text-right">Font Size:</label><input type="number" id="font-size-input" value="16" min="8" class="w-full text-sm rounded-md border-slate-300"></div><div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="text-color-input" class="text-sm font-semibold text-slate-600 text-right">Text Color:</label><input type="color" id="text-color-input" value="#000000" class="w-full h-9 p-0 rounded-md"></div><div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="line-color-input" class="text-sm font-semibold text-slate-600 text-right">Line/Arrow Color:</label><input type="color" id="line-color-input" value="#333333" class="w-full h-9 p-0 rounded-md"></div>`;
        diagramSettingsPanel.appendChild(styleSection);
        
        const arrowLabelSection = document.createElement('div');
        arrowLabelSection.innerHTML = `<h3 class="text-lg font-semibold text-slate-700 border-b pb-2 mt-4 flex items-center gap-2"><i class="fa-solid fa-right-left text-teal-500"></i><span>Rate Constants & Labels</span></h3>`;
        labelsToShow.forEach(label => { arrowLabelSection.innerHTML += `<div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="label-${label}" class="text-sm font-semibold text-slate-600 text-right">${label.toUpperCase()}:</label><input type="text" id="label-${label}" value="${defaultLabels[label]}" class="w-full text-sm rounded-md border-slate-300"></div>`; });
        const adminTypeValue = (modelTypeSelect.value === 'pk') ? document.getElementById('admin-select')?.value : document.getElementById('pk-admin-select')?.value;
        if (adminTypeValue === 'transit') { arrowLabelSection.innerHTML += `<div class="grid grid-cols-[120px_1fr] items-center gap-3 mt-3"><label for="num-transit-input" class="text-sm font-semibold text-slate-600 text-right"># Transit Comps (N):</label><input type="number" id="num-transit-input" value="4" min="1" class="w-full text-sm rounded-md border-slate-300"></div>`; }
        diagramSettingsPanel.appendChild(arrowLabelSection);
        
        const compSection = document.createElement('div');
        compSection.innerHTML = `<h3 class="text-lg font-semibold text-slate-700 border-b pb-2 mt-4 flex items-center gap-2"><i class="fa-solid fa-box text-orange-500"></i><span>Compartments</span></h3>`;
        compsToShow.forEach(compId => { const defaults = defaultCompData[compId]; compSection.innerHTML += `<div class="flex flex-col gap-3 pt-4 border-t border-slate-200 mt-4"><div class="grid grid-cols-[120px_1fr] items-center gap-3"><label for="text-${compId}" class="text-sm font-semibold text-slate-600 text-right">${defaults.t.split(' ')[0]} Text:</label><input type="text" id="text-${compId}" value="${defaults.t}" class="w-full text-sm rounded-md border-slate-300"></div><div class="grid grid-cols-[120px_1fr] items-center gap-3"><label for="color-${compId}" class="text-sm font-semibold text-slate-600 text-right">BG Color:</label><input type="color" id="color-${compId}" value="${defaults.c}" class="w-full h-9 p-0 rounded-md"></div></div>`; });
        diagramSettingsPanel.appendChild(compSection);
        
        diagramSettingsPanel.querySelectorAll('input, select').forEach(input => input.addEventListener('input', drawDiagram));
    };

    const updateModelDescription = () => {
        const config = getModelConfigFromUI();
        let title = '', components = [], assumptions = [];
        if (config.modelType === 'tmdd') {
            const pkModel = config.pkModel;
            title = `Target-Mediated Drug Disposition (TMDD) Model`;
            components.push(`A ${pkModel.numComp}-compartment pharmacokinetic model.`);
            if (pkModel.adminType === 'iv') { components.push(`Intravenous (IV) bolus administration.`); assumptions.push(`Instantaneous drug input.`); } 
            else if (pkModel.adminType === 'oral') { components.push(`First-order oral absorption.`); assumptions.push(`Absorption rate is proportional to amount in gut.`); } 
            else { components.push(`${config.numTransit || 4} transit compartments for absorption.`); assumptions.push(`Absorption follows a series of first-order transit steps.`); }
            components.push(`A receptor compartment with synthesis (k<sub>syn</sub>) and degradation (k<sub>deg</sub>).`);
            components.push(`A ligand-receptor complex (LR Complex) formed via binding (k<sub>on</sub>) and dissociation (k<sub>off</sub>).`);
            assumptions.push(`Drug in the central compartment drives receptor binding.`);
            assumptions.push(`The LR complex is eliminated via internalization (k<sub>int</sub>).`);
            assumptions.push(`Linear elimination (Kₑₗ) from the central compartment.`);
        } else {
            title = `Standard ${config.numComp}-Compartment Pharmacokinetic Model`;
            components.push(`${config.numComp} compartment(s): Central${config.numComp > 1 ? ', Peripheral(s)' : ''}.`);
            if (config.adminType === 'iv') { components.push(`Intravenous (IV) bolus administration.`); assumptions.push(`Instantaneous drug input.`); } 
            else if (config.adminType === 'oral') { components.push(`First-order oral absorption.`); assumptions.push(`Absorption rate is proportional to amount in gut.`); } 
            else { components.push(`${config.numTransit} transit compartments for absorption.`); assumptions.push(`Absorption follows a series of first-order transit steps.`); }
            assumptions.push(`Linear elimination (k₁₀) from the central compartment.`);
        }
        selectedModelPanel.innerHTML = `<div class="prose prose-sm max-w-none"><h3 class="font-bold text-lg mb-2">${title}</h3><h4 class="font-semibold mt-4 mb-1">Model Components:</h4><ul class="list-disc list-inside space-y-1">${components.map(item => `<li>${item}</li>`).join('')}</ul><h4 class="font-semibold mt-4 mb-1">Key Assumptions:</h4><ul class="list-disc list-inside space-y-1">${assumptions.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
    };
    
    const getModelConfigFromUI = () => {
        const modelType = modelTypeSelect.value;
        const getInputValue = (id) => document.getElementById(id)?.value || ''; 
        const getIntInputValue = (id) => parseInt(document.getElementById(id)?.value, 10);
        
        const config = { modelType: modelType, compartments: [], labels: {}, options: {
            shape: getInputValue('shape-select'), fontFamily: getInputValue('font-family-select') || 'sans-serif',
            fontSize: getIntInputValue('font-size-input') || 16, textColor: getInputValue('text-color-input') || '#000000',
            lineColor: getInputValue('line-color-input') || '#333333'
        }};

        diagramSettingsPanel.querySelectorAll('input[id^="label-"]').forEach(i => { config.labels[i.id.replace('label-', '')] = i.value; });
        diagramSettingsPanel.querySelectorAll('input[id^="text-"]').forEach(i => { const id = i.id.replace('text-', ''); config.compartments.push({ id: id, text: i.value, color: getInputValue(`color-${id}`) }); });

        if (modelType === 'tmdd') {
            config.pkModel = { numComp: getIntInputValue('pk-comp-select') || 2, adminType: getInputValue('pk-admin-select') || 'iv' };
            if (config.pkModel.adminType === 'transit') { config.numTransit = getIntInputValue('num-transit-input') || 4; }
        } else {
            config.numComp = getIntInputValue('compartment-select') || 2;
            config.adminType = getInputValue('admin-select') || 'iv';
            if (config.adminType === 'transit') { config.numTransit = getIntInputValue('num-transit-input') || 4; } 
        }
        return config;
    };

    const getPlotOptionsFromUI = () => {
        return {
            scale: plotScaleSelect.value,
            xTitle: document.getElementById('plot-xtitle').value, yTitle: document.getElementById('plot-ytitle').value,
            lineColor: document.getElementById('plot-linecolor').value,
            xMin: parseFloat(document.getElementById('plot-xmin').value), xMax: parseFloat(document.getElementById('plot-xmax').value), xStep: parseFloat(document.getElementById('plot-xstep').value),
            yMin: parseFloat(document.getElementById('plot-ymin').value), yMax: parseFloat(document.getElementById('plot-ymax').value), yStep: parseFloat(document.getElementById('plot-ystep').value),
            fontFamily: document.getElementById('plot-font-family').value,
            titleFontSize: parseInt(document.getElementById('plot-title-fontsize').value, 10),
            tickFontSize: parseInt(document.getElementById('plot-tick-fontsize').value, 10),
            fontColor: document.getElementById('plot-font-color').value
        };
    };
    
    const getSimOptionsFromUI = () => {
        return {
            dose: parseFloat(document.getElementById('sim-dose').value) || 100,
            numDoses: parseInt(document.getElementById('sim-num-doses').value, 10) || 1,
            interval: parseFloat(document.getElementById('sim-interval').value) || 24
        };
    };

    const drawDiagram = () => { graph.drawModel(getModelConfigFromUI(), getPlotOptionsFromUI(), getSimOptionsFromUI()); updateModelDescription(); };
    const replotOnly = () => { graph.plotter.draw(graph.simulator.solve(getModelConfigFromUI(), getSimOptionsFromUI()), getPlotOptionsFromUI()); };
    const handleDiagramCanvasResize = () => { mainCanvas.width = parseInt(canvasWidthInput.value, 10) || 900; mainCanvas.height = parseInt(canvasHeightInput.value, 10) || 450; updateOutputDimensionsPreview(); drawDiagram(); };
    const handlePlotCanvasResize = () => { plotCanvas.width = parseInt(document.getElementById('plot-width').value, 10) || 860; plotCanvas.height = parseInt(document.getElementById('plot-height').value, 10) || 300; replotOnly(); };
    const updateOutputDimensionsPreview = () => { const width = parseInt(canvasWidthInput.value, 10) || 0; const height = parseInt(canvasHeightInput.value, 10) || 0; const scale = parseFloat(imageScaleInput.value) || 1; outputDimensionsPreview.textContent = `(Output: ${Math.round(width*scale)} x ${Math.round(height*scale)} px)`; };
    const handleGenericDownload = (canvasId, baseFilename) => { html2canvas(document.getElementById(canvasId), { scale: parseFloat(imageScaleInput.value) || 3, backgroundColor: '#FFFFFF' }).then(canvas => { canvas.toBlob(blob => { saveAs(blob, `${baseFilename}.${document.getElementById('image-format-select').value}`); }, `image/${document.getElementById('image-format-select').value}`); }); };
    const handleReproducibleCodeDownload = () => { const modelConfig = getModelConfigFromUI(); const plotOptions = getPlotOptionsFromUI(); const simOptions = getSimOptionsFromUI(); const modelConfigString = JSON.stringify(modelConfig, null, 4); const plotOptionsString = JSON.stringify(plotOptions, null, 4); const simOptionsString = JSON.stringify(simOptions, null, 4); const codeTemplate = `<!DOCTYPE html><html><head><title>Generated Diagram</title><style>body{display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2rem;background-color:#f0f0f0}canvas{background-color:#fff;border:1px solid #ccc;margin-bottom:1rem;}</style></head><body><canvas id="model-canvas" width="${mainCanvas.width}" height="${mainCanvas.height}"></canvas><canvas id="plot-canvas" width="${plotCanvas.width}" height="${plotCanvas.height}"></canvas><script>${PharmaGraph.toString()};${PK_Simulator.toString()};${Plotter.toString()}<\/script><script>document.addEventListener('DOMContentLoaded',()=>{const g=new PharmaGraph('model-canvas','plot-canvas');const modelConfig=${modelConfigString};const plotOptions=${plotOptionsString};const simOptions=${simOptionsString};g.drawModel(modelConfig,plotOptions,simOptions)})<\/script></body></html>`; saveAs(new Blob([codeTemplate.trim()], {type:'text/html;charset=utf-8'}), `visualizer-${modelConfig.modelType}.html`); };
    const handleCodeDownload = (platform) => { const config = getModelConfigFromUI(); let code, extension; if (platform === 'nonmem') { code = generateNonmemCode(config); extension = 'mod'; } else if (platform === 'monolix') { code = generateMonolixCode(config); extension = 'txt'; } else { code = generateRCode(config); extension = 'R'; } const modelName = config.modelType === 'tmdd' ? `tmdd_pk${config.pkModel.numComp}c_${config.pkModel.adminType}` : `${config.numComp}comp_${config.adminType}`; const blob = new Blob([code.trim()], { type: 'text/plain;charset=utf-8' }); saveAs(blob, `${modelName}.${extension}`); };
    
    // --- Event Listeners ---
    modelTypeSelect.addEventListener('change', () => { updateModelStructureControls(); updateDiagramSettings(); drawDiagram(); });
    document.body.addEventListener('change', (event) => { if(event.target.closest('#model-structure-controls')) { updateDiagramSettings(); drawDiagram(); } });
    drawButton.addEventListener('click', drawDiagram);
    plotScaleSelect.addEventListener('change', replotOnly);
    downloadDiagramButton.addEventListener('click', () => { const config=getModelConfigFromUI(); const modelName = config.modelType === 'tmdd' ? `tmdd-pk${config.pkModel.numComp}comp-${config.pkModel.adminType}` : `${config.numComp}-comp-${config.adminType}`; handleGenericDownload('main-canvas', `${modelName}-diagram`); });
    downloadPlotButton.addEventListener('click', () => { const config=getModelConfigFromUI(); const modelName = config.modelType === 'tmdd' ? `tmdd-pk${config.pkModel.numComp}comp-${config.pkModel.adminType}` : `${config.numComp}-comp-${config.adminType}`; handleGenericDownload('plot-canvas', `${modelName}-plot`); });
    downloadCodeButton.addEventListener('click', handleReproducibleCodeDownload);
    canvasWidthInput.addEventListener('input', handleDiagramCanvasResize);
    canvasHeightInput.addEventListener('input', handleDiagramCanvasResize);
    imageScaleInput.addEventListener('input', updateOutputDimensionsPreview);
    downloadNonmemButton.addEventListener('click', () => handleCodeDownload('nonmem'));
    downloadMonolixButton.addEventListener('click', () => handleCodeDownload('monolix'));
    downloadRButton.addEventListener('click', () => handleCodeDownload('r'));

    // --- Initial Setup ---
    setupTabs();
    populatePlotSettings();
    updateModelStructureControls();
    updateDiagramSettings();
    drawDiagram();
    updateOutputDimensionsPreview();
});
