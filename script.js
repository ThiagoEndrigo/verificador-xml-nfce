document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Página carregada');
    
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    const fileInfo = document.getElementById('fileInfo');
    const processarBtn = document.getElementById('processarBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressCount = document.getElementById('progressCount');
    const statusMessage = document.getElementById('statusMessage');
    const results = document.getElementById('results');
    const showLogsBtn = document.getElementById('showLogsBtn');
    
    let arquivosSelecionados = [];
    let worker = null;
    let resultadosAtuais = null;
    
    // Testar conexão com servidor
    fetch('/ping')
        .then(response => response.json())
        .then(data => console.log('✅ Servidor respondendo:', data))
        .catch(error => console.error('❌ Erro ao conectar com servidor:', error));
    
    // Eventos de drag and drop
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(f => 
            f.name.toLowerCase().endsWith('.xml')
        );
        
        if (files.length > 0) {
            handleFiles(files);
        } else {
            alert('Por favor, selecione apenas arquivos XML');
        }
    });
    
    selectFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
    });
    
    function handleFiles(files) {
        console.log(`📁 Selecionados ${files.length} arquivos`);
        arquivosSelecionados = files;
        fileInfo.textContent = `${files.length} arquivo(s) XML selecionado(s)`;
        
        if (files.length > 20000) {
            alert('Atenção: Você selecionou mais de 20.000 arquivos. O processamento pode ser lento.');
        }
        
        processarBtn.disabled = false;
    }
    
    processarBtn.addEventListener('click', () => {
        if (arquivosSelecionados.length === 0) {
            alert('Selecione os arquivos primeiro');
            return;
        }
        
        console.log('🚀 Iniciando processamento:', { 
            arquivos: arquivosSelecionados.length 
        });
        
        iniciarProcessamento(arquivosSelecionados);
    });
    
    // Botão de logs
    showLogsBtn.addEventListener('click', () => {
        if (resultadosAtuais) {
            // Ativar a aba de log
            const tabBtns = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            document.querySelector('[data-tab="log"]').classList.add('active');
            document.getElementById('tab-log').classList.add('active');
            
            // Atualizar o log
            exibirLog(resultadosAtuais.log);
        } else {
            alert('Nenhum resultado disponível. Processe alguns arquivos primeiro.');
        }
    });
    
    function iniciarProcessamento(arquivos) {
        // Mostrar progresso
        progressContainer.style.display = 'block';
        results.style.display = 'none';
        processarBtn.disabled = true;
        
        // Resetar progresso
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressCount.textContent = `0/${arquivos.length} arquivos`;
        statusMessage.textContent = 'Preparando arquivos...';
        
        // Enviar arquivos para o servidor
        const formData = new FormData();
        arquivos.forEach(arquivo => {
            formData.append('xmls', arquivo);
        });
        
        statusMessage.textContent = 'Enviando arquivos para o servidor...';
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Erro no upload');
            }
            
            console.log('✅ Upload concluído, iniciando worker');
            console.log(`📊 Total arquivos: ${data.arquivos.length}`);
            
            statusMessage.textContent = `Processando ${data.arquivos.length} XMLs...`;
            
            // Detectar automaticamente o intervalo baseado nos números das notas
            const numeros = extrairNumerosDasNotas(data.arquivos);
            const inicio = numeros.length > 0 ? Math.min(...numeros) : 1;
            const fim = numeros.length > 0 ? Math.max(...numeros) : data.arquivos.length;
            
            console.log(`📊 Intervalo detectado: ${inicio} - ${fim}`);
            
            // Iniciar worker
            iniciarWorker(data.arquivos, inicio, fim);
        })
        .catch(error => {
            console.error('❌ Erro no upload:', error);
            alert('Erro ao enviar arquivos: ' + error.message);
            processarBtn.disabled = false;
            progressContainer.style.display = 'none';
        });
    }
    
    function extrairNumerosDasNotas(arquivos) {
        const numeros = [];
        // Analisar primeiros 100 arquivos para detectar intervalo
        const arquivosParaAnalisar = arquivos.slice(0, 100);
        
        for (const arquivo of arquivosParaAnalisar) {
            try {
                const numero = extrairNumeroNota(arquivo.conteudo);
                if (numero !== null) {
                    numeros.push(numero);
                }
            } catch (erro) {
                // Ignorar erros na detecção
            }
        }
        
        return numeros;
    }
    
    function extrairNumeroNota(xmlString) {
        const regexNumero = /<nNF[^>]*>(\d+)<\/nNF>/;
        const match = xmlString.match(regexNumero);
        return match ? parseInt(match[1], 10) : null;
    }
    
    function iniciarWorker(arquivos, inicio, fim) {
        // Criar worker
        const workerUrl = `${window.location.origin}/worker.js`;
        console.log('🔄 Criando worker em:', workerUrl);
        
        try {
            worker = new Worker(workerUrl);
            
            // Enviar dados para o worker
            worker.postMessage({
                arquivos: arquivos,
                inicio: inicio,
                fim: fim
            });
            
            // Receber mensagens do worker
            worker.onmessage = (e) => {
                const data = e.data;
                
                switch (data.tipo) {
                    case 'progresso':
                        atualizarProgresso(data);
                        break;
                        
                    case 'completo':
                        console.log('✅ Processamento completo');
                        resultadosAtuais = data.resultados;
                        exibirResultados(data.resultados);
                        exibirLog(data.resultados.log);
                        worker.terminate();
                        progressContainer.style.display = 'none';
                        results.style.display = 'block';
                        processarBtn.disabled = false;
                        
                        // Se houver erros, mostrar na status message
                        if (data.resultados.log.erros.length > 0) {
                            statusMessage.textContent = `⚠️ Processamento concluído com ${data.resultados.log.erros.length} erro(s). Clique em "Ver Logs" para detalhes.`;
                            statusMessage.style.background = 'rgba(239, 68, 68, 0.1)';
                            statusMessage.style.color = '#ef4444';
                            progressContainer.style.display = 'block';
                        }
                        break;
                        
                    case 'erro':
                        console.error('❌ Erro no worker:', data);
                        alert('Erro no processamento: ' + data.mensagem);
                        worker.terminate();
                        processarBtn.disabled = false;
                        progressContainer.style.display = 'none';
                        break;
                        
                    default:
                        console.log('📨 Mensagem do worker:', data);
                }
            };
            
            worker.onerror = (erro) => {
                console.error('❌ Erro fatal no worker:', erro);
                alert('Erro no worker: ' + erro.message);
                processarBtn.disabled = false;
                progressContainer.style.display = 'none';
            };
            
        } catch (error) {
            console.error('❌ Erro ao criar worker:', error);
            alert('Erro ao criar worker: ' + error.message);
            processarBtn.disabled = false;
            progressContainer.style.display = 'none';
        }
    }
    
    function atualizarProgresso(data) {
        progressBar.style.width = `${data.progresso}%`;
        progressPercent.textContent = `${data.progresso}%`;
        progressCount.textContent = `${data.processados}/${data.total} arquivos`;
        statusMessage.textContent = data.status || 'Processando...';
    }
    
    function exibirResultados(resultados) {
        console.log('📈 Exibindo resultados');
        
        // Atualizar estatísticas básicas
        document.getElementById('totalProcessado').textContent = resultados.totalProcessado;
        document.getElementById('faltantes').textContent = resultados.faltantes.length;
        document.getElementById('divergencias').textContent = resultados.divergencias.length;
        
        // Protocolo
        document.getElementById('comProtocolo').textContent = resultados.statusProtocolo.comProtocolo;
        document.getElementById('protocoloIncompleto').textContent = resultados.statusProtocolo.incompleto;
        document.getElementById('semProtocolo').textContent = resultados.statusProtocolo.semProtocolo;
        
        // Valores
        document.getElementById('somaVNF').textContent = formatarMoeda(resultados.somaVNF);
        document.getElementById('somaVPag').textContent = formatarMoeda(resultados.somaVPag);
        document.getElementById('diferenca').textContent = formatarMoeda(resultados.diferencaTotal);
        
        // Listas
        exibirListaSemProtocolo(resultados.notasSemProtocolo);
        exibirDivergencias(resultados.divergencias);
        exibirFaltantes(resultados.faltantes);
        exibirDuplicatas(resultados.duplicatas);
        
        // Configurar abas
        configurarAbas();
    }
    
    function exibirLog(log) {
        const container = document.getElementById('listaLog');
        if (!container) return;
        
        let html = '';
        
        // Estatísticas rápidas
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                <span style="background: #212135; padding: 8px 16px; border-radius: 20px; color: #4a9eff; border: 1px solid #2d2d44;">ℹ️ Informações: ${log.info?.length || 0}</span>
                <span style="background: #212135; padding: 8px 16px; border-radius: 20px; color: #f59e0b; border: 1px solid #2d2d44;">⚠️ Avisos: ${log.avisos?.length || 0}</span>
                <span style="background: #212135; padding: 8px 16px; border-radius: 20px; color: #ef4444; border: 1px solid #2d2d44;">❌ Erros: ${log.erros?.length || 0}</span>
            </div>
        `;
        
        if (log.erros && log.erros.length > 0) {
            html += '<h5 style="color: #ef4444; margin: 15px 0 10px;">❌ Erros:</h5>';
            log.erros.forEach(msg => {
                html += `<div class="list-item" style="color: #ef4444; background: rgba(239, 68, 68, 0.05);">❌ ${msg}</div>`;
            });
        }
        
        if (log.avisos && log.avisos.length > 0) {
            html += '<h5 style="color: #f59e0b; margin: 15px 0 10px;">⚠️ Avisos:</h5>';
            log.avisos.forEach(msg => {
                html += `<div class="list-item" style="color: #f59e0b; background: rgba(245, 158, 11, 0.05);">⚠️ ${msg}</div>`;
            });
        }
        
        if (log.info && log.info.length > 0) {
            html += '<h5 style="color: #4a9eff; margin: 15px 0 10px;">ℹ️ Informações:</h5>';
            log.info.forEach(msg => {
                html += `<div class="list-item" style="color: #4a9eff; background: rgba(74, 158, 255, 0.05);">ℹ️ ${msg}</div>`;
            });
        }
        
        if ((!log.erros || log.erros.length === 0) && 
            (!log.avisos || log.avisos.length === 0) && 
            (!log.info || log.info.length === 0)) {
            html = '<div class="list-item">Nenhum log registrado</div>';
        }
        
        container.innerHTML = html;
    }
    
    function exibirListaSemProtocolo(lista) {
        const container = document.getElementById('listaSemProtocolo');
        
        if (lista.length === 0) {
            container.innerHTML = '<div class="warning-text success">✅ Todas as notas possuem protocolo de autorização!</div>';
            return;
        }
        
        let html = `<div class="warning-text error">❌ Total: ${lista.length} nota(s) sem protocolo</div>`;
        
        lista.slice(0, 1000).forEach(item => {
            html += `
                <div class="list-item">
                    <div>
                        <span class="numero">Nota: ${item.numero}</span>
                        <span class="arquivo"> - ${item.arquivo}</span>
                    </div>
                    <span class="badge error">Sem protocolo</span>
                </div>
            `;
        });
        
        if (lista.length > 1000) {
            html += `<div class="warning-text">... e mais ${lista.length - 1000} notas não exibidas</div>`;
        }
        
        container.innerHTML = html;
    }
    
    function exibirDivergencias(lista) {
        const container = document.getElementById('listaDivergencias');
        
        if (lista.length === 0) {
            container.innerHTML = '<div class="warning-text success">✅ Nenhuma divergência encontrada!</div>';
            return;
        }
        
        let html = `<div class="warning-text warning">⚠️ Total: ${lista.length} nota(s) com divergência</div>`;
        
        lista.slice(0, 100).forEach(item => {
            const protocoloIcon = item.possuiProtocolo ? '✅' : '❌';
            const diferencaFormatada = formatarMoeda(Math.abs(item.diferenca));
            html += `
                <div class="list-item">
                    <div>
                        <span class="numero">Nota: ${item.numero}</span>
                        <span class="arquivo"> - ${item.arquivo}</span>
                        <div class="valor">
                            vNF: ${formatarMoeda(item.vNF)} | 
                            vPag: ${formatarMoeda(item.vPag)} | 
                            Dif: ${diferencaFormatada}
                        </div>
                    </div>
                    <div>
                        <span class="badge ${item.vNF > item.vPag ? 'danger' : 'warning'}">${item.status}</span>
                        <span class="badge">${protocoloIcon}</span>
                    </div>
                </div>
            `;
        });
        
        if (lista.length > 100) {
            html += `<div class="warning-text">... e mais ${lista.length - 100} divergências não exibidas</div>`;
        }
        
        container.innerHTML = html;
    }
    
    function exibirFaltantes(lista) {
        const container = document.getElementById('listaFaltantes');
        
        if (lista.length === 0) {
            container.innerHTML = '<div class="warning-text success">✅ Nenhum número faltante no intervalo!</div>';
            return;
        }
        
        let html = `<div class="warning-text">🔍 Total: ${lista.length} número(s) faltante(s)</div>`;
        
        // Agrupar em intervalos
        const intervalos = [];
        if (lista.length > 0) {
            let inicio = lista[0];
            let fim = lista[0];
            
            for (let i = 1; i < lista.length; i++) {
                if (lista[i] === fim + 1) {
                    fim = lista[i];
                } else {
                    intervalos.push(inicio === fim ? `${inicio}` : `${inicio}-${fim}`);
                    inicio = lista[i];
                    fim = lista[i];
                }
            }
            intervalos.push(inicio === fim ? `${inicio}` : `${inicio}-${fim}`);
        }
        
        html += '<div class="intervalos" style="margin-top: 10px;">';
        intervalos.forEach(intervalo => {
            html += `<span class="intervalo-badge">${intervalo}</span> `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    function exibirDuplicatas(lista) {
        const container = document.getElementById('listaDuplicatas');
        
        if (lista.length === 0) {
            container.innerHTML = '<div class="warning-text success">✅ Nenhuma nota duplicada encontrada!</div>';
            return;
        }
        
        let html = `<div class="warning-text warning">📋 Total: ${lista.length} nota(s) duplicada(s)</div>`;
        
        lista.slice(0, 50).forEach(item => {
            html += `
                <div class="list-item">
                    <div>
                        <span class="numero">Nota: ${item.numero}</span>
                        <span class="badge">${item.arquivos.length} ocorrências</span>
                    </div>
                    <div style="font-size: 0.9em; color: #a5b4fc; margin-top: 5px;">
                        ${item.arquivos.map(arq => `📄 ${arq}`).join('<br>')}
                    </div>
                </div>
            `;
        });
        
        if (lista.length > 50) {
            html += `<div class="warning-text">... e mais ${lista.length - 50} duplicatas não exibidas</div>`;
        }
        
        container.innerHTML = html;
    }
    
    function configurarAbas() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }
    
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }
    
    // Botão de exportar
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (!resultadosAtuais) {
            alert('Nenhum resultado para exportar');
            return;
        }
        
        const relatorio = {
            data: new Date().toLocaleString(),
            estatisticas: {
                totalProcessado: resultadosAtuais.totalProcessado,
                notasFaltantes: resultadosAtuais.faltantes.length,
                divergencias: resultadosAtuais.divergencias.length,
                protocolo: {
                    comProtocolo: resultadosAtuais.statusProtocolo.comProtocolo,
                    semProtocolo: resultadosAtuais.statusProtocolo.semProtocolo,
                    incompleto: resultadosAtuais.statusProtocolo.incompleto
                },
                valores: {
                    somaVNF: resultadosAtuais.somaVNF,
                    somaVPag: resultadosAtuais.somaVPag,
                    diferenca: resultadosAtuais.diferencaTotal
                }
            },
            logs: {
                totalErros: resultadosAtuais.log.erros.length,
                totalAvisos: resultadosAtuais.log.avisos.length,
                totalInfo: resultadosAtuais.log.info.length,
                primeirosErros: resultadosAtuais.log.erros.slice(0, 50)
            }
        };
        
        const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-xml-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
});