# 📄 Verificador de XMLs NFC-e v2.3

![Version](https://img.shields.io/badge/version-2.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)

Sistema web para processamento e validação de arquivos XML de Notas Fiscais de Consumidor Eletrônica (NFC-e). Processa até **20.000 arquivos** diretamente no navegador.

## 🚀 Funcionalidades

- ✅ Upload múltiplo de arquivos XML (drag & drop)
- ✅ Validação de protocolo de autorização
- ✅ Verificação de divergências entre vNF e vPag
- ✅ Identificação de números faltantes em sequência
- ✅ Detecção de notas duplicadas
- ✅ Processamento via Web Worker (não trava a interface)
- ✅ Exportação de relatório em JSON

## 📊 O que é verificado

| Verificação | Descrição |
|------------|-----------|
| **Protocolo** | Identifica notas sem protocolo, com protocolo incompleto ou completo |
| **Divergências** | Compara valor da nota (vNF) com valor pago (vPag) |
| **Faltantes** | Encontra números de nota que não foram processados |
| **Duplicatas** | Detecta mesmo número de nota em múltiplos arquivos |

## 🛠️ Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Node.js, Express
- **Processamento:** Web Workers
- **Upload:** Multer

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/verificador-xml-nfce.git

# Entre no diretório
cd verificador-xml-nfce

# Instale as dependências
npm install

# Inicie o servidor
npm start