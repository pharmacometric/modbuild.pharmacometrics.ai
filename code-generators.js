/**
 * @file code-generators.js
 * @description Contains functions to generate model code for NONMEM, Monolix, and R (mrgsolve).
 */

function generateNonmemCode(config) {
    const { modelType } = config;
    const today = new Date().toISOString().split('T')[0];
    let header, problem, input, data, subroutines, model, pk, error, theta, omega, sigma, estimation, table;

    // Default sections
    input = `$INPUT ID TIME DV AMT EVID MDV CMT`;
    data = `$DATA data.csv IGNORE=@`;
    error = `$ERROR\nY = F * (1 + ERR(1)) + ERR(2)\nIPRED = F`;
    sigma = `$SIGMA\n(0.09) ; Proportional Error\n(0.01) ; Additive Error`;
    estimation = `$ESTIMATION METHOD=1 INTER MAXEVAL=9999 PRINT=5 POSTHOC`;
    
    if (modelType === 'tmdd') {
        const { pkModel, numTransit = 4 } = config;
        const { numComp, adminType } = pkModel;

        problem = `$PROBLEM TMDD Model with ${numComp}-Comp PK and ${adminType} admin`;
        header = `;; Model: ${problem.replace('$PROBLEM ', '')}\n;; Author: William Hane\n;; Date: ${today}`;
        
        const pkParams = (numComp === 1) ? ['CL', 'V1'] : ['CL', 'V1', 'Q', 'V2'];
        const tmddParams = ['KINT', 'KON', 'KOFF', 'KSYN', 'KDEG'];
        let adminParams = [];
        if(adminType === 'oral') adminParams = ['KA'];
        if(adminType === 'transit') adminParams = ['MTT'];
        
        const allParams = [...adminParams, ...pkParams, ...tmddParams];
        
        subroutines = `$SUBROUTINES ADVAN13`;
        model = `COMP=(DEPOT,DEFDOS) COMP=(CENTRAL,DEFOBS) COMP=(PERIPH) COMP=(RECEPTOR) COMP=(COMPLEX)`;
        if(adminType === 'transit') model = `N_TRANSIT=${numTransit} ${model}`;
        
        pk = `$PK
; THETAS: ${allParams.join(', ')}
${allParams.map((p, i) => `${p} = THETA(${i+1}) * EXP(ETA(${i+1}))`).join('\n')}

; TMDD equations
K10 = CL/V1
K12 = 0
K21 = 0
IF (NPARAM.GE.5) K12 = Q/V1
IF (NPARAM.GE.5) K21 = Q/V2

; Rates for ADVAN13
E_R = KSYN - KDEG*A(4) - KON*A(2)*A(4) + KOFF*A(5)
E_LR = KON*A(2)*A(4) - KOFF*A(5) - KINT*A(5)

; SCALING
S2 = V1  ; Scales CENT to Concentration
S4 = 1   ; Receptor amount
S5 = 1   ; Complex amount
`;
        if (adminType === 'transit') pk += `\nN = ${numTransit}\nKTR = (N+1)/MTT\nD1 = MTT\nF1=1`;
        if (adminType === 'oral') pk += `\nF1=1`;

        theta = `$THETA\n${allParams.map(p => `(0, 1) ; ${p}`).join('\n')}`;
        omega = `$OMEGA\n${allParams.map((p, i) => `(0.09) ; BSV on ${p}`).join('\n')}`;
        table = `$TABLE ID TIME EVID AMT CMT DV IPRED NOPRINT ONEHEADER FILE=tmdd.tab`;

    } else { // Standard PK
        const { numComp, adminType, numTransit = 4 } = config;
        problem = `$PROBLEM ${numComp}-Compartment Model with ${adminType} administration`;
        header = `;; Model: ${problem.replace('$PROBLEM ', '')}\n;; Author: William Hane\n;; Date: ${today}`;

        const pkParams = { iv: {1:['CL','V'], 2:['CL','V1','Q','V2'], 3:['CL','V1','Q2','V2','Q3','V3']}, oral: {1:['KA','CL','V'], 2:['KA','CL','V1','Q','V2'], 3:['KA','CL','V1','Q2','V2','Q3','V3']}, transit: {1:['MTT','CL','V'], 2:['MTT','CL','V1','Q','V2'], 3:['MTT','CL','V1','Q2','V2','Q3','V3']} };
        const params = pkParams[adminType][numComp];
        
        if (adminType !== 'transit' && numComp < 3) {
            const advanMap = { '1-iv': 'ADVAN1 TRANS1', '1-oral': 'ADVAN2 TRANS2', '2-iv': 'ADVAN3 TRANS3', '2-oral': 'ADVAN4 TRANS4' };
            subroutines = `$SUBROUTINES ${advanMap[`${numComp}-${adminType}`]}`;
            model = '';
        } else {
            subroutines = `$SUBROUTINES ADVAN13`;
            model = (adminType === 'transit') ? `$MODEL N_TRANSIT=${numTransit} COMP=(DEPOT,DEFDOS) COMP=(CENTRAL,DEFOBS)` : '';
        }

        pk = `$PK\n${params.map((p, i) => `${p} = THETA(${i+1})*EXP(ETA(${i+1}))`).join('\n')}\n`;
        const depotCmt = (adminType === 'oral' || adminType === 'transit') ? 2 : 1;
        let modelBlock = `S${depotCmt} = V1`;
        if (numComp === 1) modelBlock = `S${depotCmt} = V`;
        if (numComp >= 3 || (adminType === 'transit' && numComp > 1)) {
            modelBlock = `K10 = CL/V1\n`;
            if(numComp > 1) modelBlock += `K12 = Q2/V1\nK21 = Q2/V2\n`;
            if(numComp > 2) modelBlock += `K13 = Q3/V1\nK31 = Q3/V3\n`;
            modelBlock += `S2 = V1`;
        }
        if (adminType === 'transit') { modelBlock += `\nN = ${numTransit}\nKTR = (N+1)/MTT\nD1 = MTT\nF1=1`;}
        if (adminType === 'oral' && numComp >=3) { modelBlock +=`\nF1=1`; }
        pk += `\n${modelBlock}`;

        theta = `$THETA\n${params.map(p => `(0, 1) ; ${p}`).join('\n')}`;
        omega = `$OMEGA\n${params.map((p, i) => `(0.09) ; BSV on ${p}`).join('\n')}`;
        table = `$TABLE ID TIME EVID AMT CMT DV IPRED NOPRINT ONEHEADER FILE=${numComp}comp_${adminType}.tab`;
    }

    return [header, problem, input, data, subroutines, model, pk, error, theta, omega, sigma, estimation, table]
        .filter(Boolean) // Remove empty sections
        .join('\n\n');
}


function generateMonolixCode(config) { /* ... Unchanged from final version ... */ }
function generateRCode(config) { /* ... Unchanged from final version ... */ }