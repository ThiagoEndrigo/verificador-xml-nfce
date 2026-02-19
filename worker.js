// Worker para processamento pesado
console.log('✅ Worker iniciado - Versão com parser XML alternativo');

// Sistema de log
const log = {
    erros: [],
    avisos: [],
    info: []
};

// Função para parsear XML sem DOMParser
function parseXML(xmlString) {
    try {
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            return parser.parseFromString(xmlString, "text/xml");
        } else {
            return parseXMLManually(xmlString);
        }
    } catch (erro) {
        throw new Error(`Erro ao parsear XML: ${erro.message}`);
    }
}

// Parser manual para Web Worker
function parseXMLManually(xmlString) {
    const result = {
        querySelector: function(selector) {
            return findElement(xmlString, selector);
        },
        querySelectorAll: function(selector) {
            return findElements(xmlString, selector);
        }
    };
    return result;
}

function findElement(xmlString, selector) {
    const tags = selector.split(' ');
    let currentXml = xmlString;
    
    for (const tag of tags) {
        const match = currentXml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
        if (!match) return null;
        currentXml = match[1];
    }
    
    return {
        textContent: currentXml,
        querySelector: (sel) => findElement(currentXml, sel)
    };
}

function findElements(xmlString, selector) {
    const matches = [];
    const regex = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, 'gs');
    let match;
    
    while ((match = regex.exec(xmlString)) !== null) {
        matches.push({
            textContent: match[1],
            querySelector: (sel) => findElement(match[1], sel)
        });
    }
    
    return matches;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function compararValoresMonetarios(a, b, tolerancia = 0.009) {
    return Math.abs(a - b) <= tolerancia;
}

function getElementText(xmlDoc, seletor) {
    try {
        if (typeof xmlDoc.querySelector === 'function') {
            const elem = xmlDoc.querySelector(seletor);
            return elem ? elem.textContent : null;
        } else {
            const match = xmlDoc.match(new RegExp(`<${seletor}[^>]*>(.*?)</${seletor}>`, 's'));
            return match ? match[1].trim() : null;
        }
    } catch (erro) {
        return null;
    }
}

function validarEstruturaXML(xmlDoc, xmlString) {
    const estruturasValidas = [
        !!getElementText(xmlDoc, 'nfeProc NFe infNFe ide nNF'),
        !!getElementText(xmlDoc, 'NFe infNFe ide nNF'),
        !!getElementText(xmlDoc, 'infNFe ide nNF')
    ];
    
    return estruturasValidas.some(valida => valida === true);
}

function extrairValoresXML(xmlDoc, xmlString, nomeArquivo) {
    let vNF = 0;
    let vPag = 0;
    let numero = null;
    
    try {
        log.info.push(`Arquivo ${nomeArquivo}: Processando...`);
        
        const nNF = getElementText(xmlDoc, 'nNF') || 
                    getElementText(xmlDoc, 'ide nNF') ||
                    getElementText(xmlDoc, 'infNFe ide nNF') ||
                    getElementText(xmlDoc, 'NFe infNFe ide nNF') ||
                    getElementText(xmlDoc, 'nfeProc NFe infNFe ide nNF');
        
        if (nNF) {
            numero = parseInt(nNF, 10);
            if (isNaN(numero)) numero = null;
        }
        
        const vNFText = getElementText(xmlDoc, 'vNF') || 
                        getElementText(xmlDoc, 'ICMSTot vNF') ||
                        getElementText(xmlDoc, 'total ICMSTot vNF') ||
                        getElementText(xmlDoc, 'infNFe total ICMSTot vNF');
        
        if (vNFText) {
            vNF = parseFloat(vNFText.replace(',', '.')) || 0;
        }
        
        const vPagRegex = /<vPag[^>]*>(.*?)<\/vPag>/gs;
        let match;
        while ((match = vPagRegex.exec(xmlString)) !== null) {
            vPag += parseFloat(match[1].replace(',', '.')) || 0;
        }
        
        if (vPag === 0) {
            const vPagText = getElementText(xmlDoc, 'detPag vPag') || 
                            getElementText(xmlDoc, 'pag vPag') ||
                            getElementText(xmlDoc, 'infNFe pag vPag');
            
            if (vPagText) {
                vPag = parseFloat(vPagText.replace(',', '.')) || 0;
            }
        }
        
    } catch (erro) {
        log.erros.push(`Arquivo ${nomeArquivo}: Erro ao extrair valores - ${erro.message}`);
    }
    
    return { numero, vNF, vPag };
}

function verificarProtocoloNota(xmlDoc, xmlString) {
    try {
        const temProtNFe = xmlString.includes('<protNFe') || 
                          xmlString.includes('<protNFe>');
        
        if (!temProtNFe) {
            return {
                possuiProtocolo: false,
                completo: false,
                detalhes: null
            };
        }
        
        const cStat = getElementText(xmlDoc, 'cStat');
        const nProt = getElementText(xmlDoc, 'nProt');
        const xMotivo = getElementText(xmlDoc, 'xMotivo');
        const dhRecbto = getElementText(xmlDoc, 'dhRecbto');
        
        const possuiCamposEssenciais = !!(cStat && nProt);
        
        return {
            possuiProtocolo: true,
            completo: possuiCamposEssenciais,
            detalhes: {
                cStat: cStat || null,
                nProt: nProt || null,
                xMotivo: xMotivo || null,
                dhRecbto: dhRecbto || null
            }
        };
        
    } catch (erro) {
        return {
            possuiProtocolo: false,
            completo: false,
            detalhes: null,
            erro: erro.message
        };
    }
}

function encontrarFaltantes(inicio, fim, encontradosSet) {
    const faltantes = [];
    for (let i = inicio; i <= fim; i++) {
        if (!encontradosSet.has(i)) faltantes.push(i);
    }
    return faltantes;
}

self.onmessage = function(e) {
    console.log('📥 Worker recebeu dados para processar');
    
    const { arquivos, inicio, fim } = e.data;
    
    if (!arquivos || !Array.isArray(arquivos)) {
        self.postMessage({
            tipo: 'erro',
            mensagem: 'Dados inválidos recebidos pelo worker'
        });
        return;
    }
    
    console.log(`📊 Total de arquivos a processar: ${arquivos.length}`);
    console.log(`📊 Intervalo informado: ${inicio} - ${fim}`);
    
    log.erros = [];
    log.avisos = [];
    log.info = [];
    
    const resultados = {
        somaVNF: 0,
        somaVPag: 0,
        encontrados: new Set(),
        divergencias: [],
        duplicatas: new Map(),
        numerosProcessados: new Set(),
        totalProcessado: 0,
        notasSemProtocolo: [],
        notasComProtocoloIncompleto: [],
        statusProtocolo: {
            total: 0,
            comProtocolo: 0,
            semProtocolo: 0,
            incompleto: 0
        }
    };
    
    const totalArquivos = arquivos.length;
    
    // Processar todos os arquivos de uma vez, sem lotes
    for (let i = 0; i < totalArquivos; i++) {
        const arquivo = arquivos[i];
        
        try {
            const { nome, conteudo } = arquivo;
            
            const xmlDoc = parseXML(conteudo);
            
            if (!validarEstruturaXML(xmlDoc, conteudo)) {
                log.avisos.push(`Arquivo ${nome}: Estrutura XML não reconhecida`);
                resultados.totalProcessado++;
                continue;
            }
            
            const { numero, vNF, vPag } = extrairValoresXML(xmlDoc, conteudo, nome);
            
            const protocolo = verificarProtocoloNota(xmlDoc, conteudo);
            resultados.statusProtocolo.total++;
            
            if (!protocolo.possuiProtocolo) {
                resultados.statusProtocolo.semProtocolo++;
                resultados.notasSemProtocolo.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    motivo: 'Protocolo de autorização não encontrado'
                });
            } else if (!protocolo.completo) {
                resultados.statusProtocolo.incompleto++;
                resultados.notasComProtocoloIncompleto.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    motivo: 'Protocolo incompleto',
                    detalhes: protocolo.detalhes
                });
            } else {
                resultados.statusProtocolo.comProtocolo++;
            }
            
            if (numero !== null) {
                if (resultados.numerosProcessados.has(numero)) {
                    if (!resultados.duplicatas.has(numero)) {
                        resultados.duplicatas.set(numero, []);
                    }
                    resultados.duplicatas.get(numero).push(nome);
                    log.avisos.push(`Nota ${numero} duplicada no arquivo: ${nome}`);
                } else {
                    resultados.numerosProcessados.add(numero);
                }
                
                if (numero >= inicio && numero <= fim) {
                    resultados.encontrados.add(numero);
                }
            }
            
            resultados.somaVNF += vNF;
            resultados.somaVPag += vPag;
            
            if (!compararValoresMonetarios(vNF, vPag)) {
                resultados.divergencias.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    vNF: vNF,
                    vPag: vPag,
                    diferenca: vNF - vPag,
                    status: vNF > vPag ? 'vNF MAIOR' : 'vPag MAIOR',
                    possuiProtocolo: protocolo.possuiProtocolo
                });
            }
            
            resultados.totalProcessado++;
            
        } catch (erro) {
            log.erros.push(`Arquivo ${arquivo.nome}: ${erro.message}`);
            resultados.totalProcessado++;
        }
        
        // Enviar progresso a cada 100 arquivos ou no final
        if ((i + 1) % 100 === 0 || i === totalArquivos - 1) {
            const percentual = Math.floor(((i + 1) / totalArquivos) * 100);
            
            self.postMessage({
                tipo: 'progresso',
                progresso: percentual,
                processados: i + 1,
                total: totalArquivos,
                status: `Processando... (${i + 1}/${totalArquivos})`
            });
        }
    }
    
    const faltantes = encontrarFaltantes(inicio, fim, resultados.encontrados);
    
    console.log('✅ Worker finalizou processamento');
    console.log(`📊 Total processado: ${resultados.totalProcessado}`);
    console.log(`📊 Total encontrados no intervalo: ${resultados.encontrados.size}`);
    console.log(`📊 Primeiros 20 encontrados:`, Array.from(resultados.encontrados).slice(0, 20));
    console.log(`📊 Últimos 20 encontrados:`, Array.from(resultados.encontrados).slice(-20));
    
    // Ordenar os números encontrados
    const encontradosArray = Array.from(resultados.encontrados).sort((a, b) => a - b);
    
    self.postMessage({
        tipo: 'completo',
        resultados: {
            ...resultados,
            encontrados: encontradosArray,
            duplicatas: Array.from(resultados.duplicatas.entries())
                .map(([numero, arquivos]) => ({ numero, arquivos })),
            faltantes: faltantes,
            diferencaTotal: resultados.somaVNF - resultados.somaVPag,
            porcentagemComProtocolo: resultados.statusProtocolo.total > 0 ? 
                ((resultados.statusProtocolo.comProtocolo / resultados.statusProtocolo.total) * 100).toFixed(1) : '0.0',
            todasTemProtocolo: resultados.statusProtocolo.semProtocolo === 0,
            log: {
                erros: log.erros,
                avisos: log.avisos,
                info: log.info
            }
        }
    });
};

self.onerror = function(erro) {
    console.error('❌ Erro no worker:', erro);
    self.postMessage({
        tipo: 'erro',
        mensagem: erro.message || 'Erro desconhecido no worker'
    });
};