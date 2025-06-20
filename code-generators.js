/**
 * @file code-generators.js
 * @description Contains functions to generate model code for NONMEM, Monolix, and R (mrgsolve).
 */

function generateNonmemCode(config) {
    const { numComp, adminType, numTransit } = config;
    const today = new Date().toISOString().split('T')[0];

    const pkParams = {
        iv: {1:['CL','V'], 2:['CL','V1','Q','V2'], 3:['CL','V1','Q2','V2','Q3','V3']},
        oral: {1:['KA','CL','V'], 2:['KA','CL','V1','Q','V2'], 3:['KA','CL','V1','Q2','V2','Q3','V3']},
        transit: {1:['MTT','CL','V'], 2:['MTT','CL','V1','Q','V2'], 3:['MTT','CL','V1','Q2','V2','Q3','V3']}
    };
    const params = pkParams[adminType][numComp];
    const nTheta = params.length;
    const depotCmt = (adminType === 'oral' || adminType === 'transit') ? 2 : 1;
    
    let subroutine = 'ADVAN13'; // General ODE solver for most complex cases
    if (adminType !== 'transit' && numComp < 3) {
        const advanMap = { '1-iv': 'ADVAN1 TRANS1', '1-oral': 'ADVAN2 TRANS2', '2-iv': 'ADVAN3 TRANS3', '2-oral': 'ADVAN4 TRANS4' };
        subroutine = advanMap[`${numComp}-${adminType}`];
    }
    
    let pkBlock = params.map((p, i) => `${p} = THETA(${i+1}) * EXP(ETA(${i+1}))`).join('\n');
    if(adminType === 'transit') {
        pkBlock += `\nN = ${numTransit}\nKTR = (N+1)/MTT`;
    }

    let modelBlock = `S${depotCmt} = V1`; // Default for most models
    if (numComp === 1) modelBlock = `S${depotCmt} = V`;
    if (numComp >= 3 || adminType === 'transit') {
        modelBlock = `K10 = CL/V1\n`;
        if(numComp > 1) modelBlock += `K12 = Q2/V1\nK21 = Q2/V2\n`;
        if(numComp > 2) modelBlock += `K13 = Q3/V1\nK31 = Q3/V3\n`;
        modelBlock += `S2 = V1` // ADVAN13 central is always CMT=2 if absorption is CMT=1
    }
     if (adminType === 'transit') modelBlock += `\nF1=1\nD1=MTT`;
     if (adminType === 'oral' && numComp >=3) modelBlock +=`\nF1=1`;

    return `;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Model: ${numComp}-Compartment Model with ${adminType} administration
;; Author: William Hane
;; Date: ${today}
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

$PROBLEM ${numComp}-Comp, ${adminType}
$INPUT ID TIME DV AMT EVID MDV CMT
$DATA data.csv IGNORE=@

$SUBROUTINES ${subroutine}
${adminType === 'transit' ? `$\n$MODEL N_TRANSIT=${numTransit} COMP=(DEPOT,DEFDOS) COMP=(CENTRAL,DEFOBS)`: ''}

$PK
${pkBlock}

${modelBlock}

$ERROR
Y = F * (1 + ERR(1)) + ERR(2)
IPRED = F

$THETA
${params.map(p => `(0, 1) ; ${p}`).join('\n')}

$OMEGA
${params.map((_, i) => `(0.09) ; BSV on THETA(${i+1})`).join('\n')}

$SIGMA
(0.09) ; Proportional Error
(0.01) ; Additive Error
`;
}

function generateMonolixCode(config) {
    const { numComp, adminType, numTransit } = config;
    const today = new Date().toISOString().split('T')[0];

    const pkParams = {
        iv: {1:['Cl','V'], 2:['Cl','V1','Q','V2'], 3:['Cl','V1','Q2','V2','Q3','V3']},
        oral: {1:['ka','Cl','V'], 2:['ka','Cl','V1','Q','V2'], 3:['ka','Cl','V1','Q2','V2','Q3','V3']},
        transit: {1:['Mtt','Cl','V'], 2:['Mtt','Cl','V1','Q','V2'], 3:['Mtt','Cl','V1','Q2','V2','Q3','V3']}
    };
    const params = pkParams[adminType][numComp];
    if (adminType === 'transit') params.push('Ntr');

    let pkMacro = (adminType === 'iv') ? 'iv(cmt=1)' : (adminType === 'oral') ? 'depot(target=A1, ka)' : `transit(target=A1, Mtt, Ntr)`;
    
    let odeBlock = `
; --- ODE Block ---
k = Cl/V1
ddt_A1 = -k*A1
Cc = A1/V1
`;
    if (numComp === 2) { odeBlock = `\nk = Cl/V1; k12 = Q/V1; k21 = Q/V2\nddt_A1 = -(k+k12)*A1 + k21*A2\nddt_A2 = k12*A1 - k21*A2\nCc = A1/V1`; }
    else if (numComp === 3) { odeBlock = `\nk = Cl/V1; k12 = Q2/V1; k21 = Q2/V2; k13 = Q3/V1; k31 = Q3/V3\nddt_A1 = -(k+k12+k13)*A1 + k21*A2 + k31*A3\nddt_A2 = k12*A1 - k21*A2\nddt_A3 = k13*A1 - k31*A3\nCc = A1/V1`;}
    if (numComp === 1) odeBlock = odeBlock.replace(/V1/g, 'V');

    return `DESCRIPTION:
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Model: ${numComp}-Compartment Model with ${adminType} administration
; Author: William Hane
; Date: ${today}
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

<MODEL>
[LONGITUDINAL]
input = {${params.join(', ')}}

PK:
${pkMacro}
${numComp > 1 ? `compartment(cmt=2, amount=A2)` : ''}
${numComp > 2 ? `compartment(cmt=3, amount=A3)` : ''}

EQUATION:${odeBlock}

OUTPUT:
output = Cc

[INDIVIDUAL]
DEFINITION:
${params.map(p => `${p} = {distribution=lognormal, typical=${p}_pop, sd=omega_${p}}`).join('\n')}

<PARAMETER>
${params.map(p => `${p}_pop = 1`).join('\n')}
${params.map(p => `omega_${p} = 0.3`).join('\n')}
${adminType === 'transit' ? `Ntr = ${numTransit}` : ''}
a = 1
b = 0.1

<DESIGN>
; Specify your study design here

<FIT>
data = ...
settings = ...
`;
}

function generateRCode(config) {
    const { numComp, adminType, numTransit } = config;
    
    const pkParams = { 
        iv: {1:['CL','V'], 2:['CL','V1','Q','V2'], 3:['CL','V1','Q2','V2','Q3','V3']}, 
        oral: {1:['KA','CL','V'], 2:['KA','CL','V1','Q','V2'], 3:['KA','CL','V1','Q2','V2','Q3','V3']}, 
        transit: {1:['MTT','CL','V'], 2:['MTT','CL','V1','Q','V2'], 3:['MTT','CL','V1','Q2','V2','Q3','V3']} 
    };
    const params = pkParams[adminType][numComp];
    if (adminType === 'transit') params.push('N');
    
    let cmtBlock = `CENT : Central compartment (mg)\n`;
    if (adminType.includes('oral')) cmtBlock = 'GUT : Absorption compartment (mg)\n' + cmtBlock;
    if (adminType === 'transit') { 
        const transitCmts = Array.from({length: numTransit}, (_,i) => `TRANS${i+1} : Transit ${i+1}`).join('\n'); 
        cmtBlock = `GUT : Dose compartment\n${transitCmts}\n` + cmtBlock; 
    }
    if(numComp > 1) cmtBlock += `PERIPH1 : Peripheral compartment 1 (mg)\n`; 
    if(numComp > 2) cmtBlock += `PERIPH2 : Peripheral compartment 2 (mg)\n`;
    
    const V = numComp > 1 ? 'V1' : 'V';
    let mainBlock = `double K10 = CL/${V};\n`;
    if(numComp > 1) mainBlock += `double K12 = Q2/${V}; double K21 = Q2/V2;\n`; 
    if(numComp > 2) mainBlock += `double K13 = Q3/${V}; double K31 = Q3/V3;\n`;
    if(adminType === 'transit') mainBlock += `double KTR = (N+1)/MTT;\n`;
    
    let odeBlock = `dxdt_CENT = -K10*CENT;\n`;
    if(numComp > 1) odeBlock = `dxdt_CENT = -(K10+K12)*CENT + K21*PERIPH1;\ndxdt_PERIPH1 = K12*CENT - K21*PERIPH1;\n`;
    if(numComp > 2) odeBlock = `dxdt_CENT = -(K10+K12+K13)*CENT + K21*PERIPH1 + K31*PERIPH2;\ndxdt_PERIPH1 = K12*CENT - K21*PERIPH1;\ndxdt_PERIPH2 = K13*CENT - K31*PERIPH2;\n`;
    
    if(adminType === 'oral') { 
        odeBlock = `dxdt_GUT = -KA*GUT;\ndxdt_CENT += KA*GUT;\n` + odeBlock.replace('dxdt_CENT +=', 'dxdt_CENT ='); 
    } else if (adminType === 'transit') { 
        let transitODEs = `dxdt_GUT = -KTR*GUT;\ndxdt_TRANS1 = KTR*GUT - KTR*TRANS1;\n`; 
        for(let i=2; i<=numTransit; ++i) { transitODEs += `dxdt_TRANS${i} = KTR*TRANS${i-1} - KTR*TRANS${i};\n`; } 
        odeBlock = transitODEs + `dxdt_CENT += KTR*TRANS${numTransit};\n` + odeBlock.replace('dxdt_CENT +=', 'dxdt_CENT ='); 
    }
    
    const doseCmt = adminType === 'iv' ? 'CENT' : 'GUT';

    return `
####################################################################
# Author: William Hane
# Date: 0/0/2026
# Purpose: run simulations for MODEL
####################################################################
#
# Load required libraries
library(mrgsolve)
library(ggplot2)

# Define the model using C++ code in a string
code <- '
[PARAM] @annotated
${params.map(p => `${p} : 1 : Parameter description`).join('\n')}
Q2 : 1 : Parameter description

[CMT] @annotated
${cmtBlock}
[MAIN]
${mainBlock}
[ODE]
${odeBlock}
[TABLE]
capture CP = CENT/${V};
'

# Compile and run simulation
mod <- mread("WilliamExample",code = code)

sim <- mod %>%
  ${adminType==='transit' ? `param(N = ${numTransit}) %>%` : ''}
  ev(amt = 100, cmt = "${doseCmt}") %>%
  mrgsim(end = 48, delta = 0.1) 
sim %>%
  plot(CP ~ time)
`;
}