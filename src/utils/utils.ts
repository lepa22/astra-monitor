import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import Config from '../config.js';
import ProcessorMonitor from '../processor/processorMonitor.js';
import MemoryMonitor from '../memory/memoryMonitor.js';
import StorageMonitor, { BlockDevice } from '../storage/storageMonitor.js';
import NetworkMonitor from '../network/networkMonitor.js';
import SensorsMonitor from '../sensors/sensorsMonitor.js';

type GTop = typeof import('gi://GTop').default;

type Extension = import('resource:///org/gnome/shell/extensions/extension.js').Extension;
type ExtensionMetadata = import('resource:///org/gnome/shell/extensions/extension.js').ExtensionMetadata;
type Button = import('resource:///org/gnome/shell/ui/panelMenu.js').Button;

type UtilsInitProps = {
    extension?: Extension;
    metadata?: ExtensionMetadata;
    settings: Gio.Settings;

    ProcessorMonitor?: typeof ProcessorMonitor;
    MemoryMonitor?: typeof MemoryMonitor;
    StorageMonitor?: typeof StorageMonitor;
    NetworkMonitor?: typeof NetworkMonitor;
    SensorsMonitor?: typeof SensorsMonitor;
};

export type GpuInfo = {
    domain:string,
    bus:string,
    vendor:string,
    slot:string,
    model:string,
    vendorId?:string,
    productId?:string,
    drivers?:string[],
    modules?:string[]
};

type DiskInfo = {
    id: string,
    name: string,
    label: string,
    mountpoints: string[],
    path: string,
    children?: DiskInfo[],
};

export type InterfaceInfo = {
    name: string,
    flags: string[],
    ifindex: number,
    mtu?: number,
    qdisc?: string,
    operstate?: string,
    linkmode?: string,
    group?: string,
    txqlen?: number,
    link_type?: string,
    address?: string,
    broadcast?: string,
    netmask?: string,
    altnames?: string[],
    addr_info?: {
        local: string,
        peer: string,
        family: string,
        broadcast: string,
        anycast: string
    }[],
    linkinfo?: any,
};

export type Color = { red: number, green: number, blue: number, alpha: number };

export type UptimeTimer = {stop: () => void};

export default class Utils {
    static debug = false;
    static defaultMonitors = ['processor', 'memory', 'storage', 'network', 'sensors'];
    static defaultIndicators = {
        processor: ['icon', 'bar', 'graph', 'percentage'],
        memory: ['icon', 'bar', 'graph', 'percentage', 'value'],
        storage: ['icon', 'bar', 'percentage', 'IO bar', 'IO graph', 'IO speed'],
        network: ['icon', 'IO bar', 'IO graph', 'IO speed'],
        sensors: ['icon', 'value']
    };
    
    static GTop?: GTop | false;
    static extension?: Extension;
    static metadata?: ExtensionMetadata;
    
    static container: Button;
    
    static processorMonitor: ProcessorMonitor;
    static memoryMonitor: MemoryMonitor;
    static storageMonitor: StorageMonitor;
    static networkMonitor: NetworkMonitor;
    static sensorsMonitor: SensorsMonitor;
    
    static ready = false;
    
    static init({
        extension,
        metadata,
        settings,
        
        ProcessorMonitor,
        MemoryMonitor,
        StorageMonitor,
        NetworkMonitor,
        SensorsMonitor
    }: UtilsInitProps) {
        if(extension)
            Utils.extension = extension;
        Utils.metadata = metadata;
        Config.settings = settings;
        
        Utils.debug = Config.get_boolean('debug-mode');
        
        if(ProcessorMonitor)
            Utils.processorMonitor = new ProcessorMonitor();
        if(MemoryMonitor)
            Utils.memoryMonitor = new MemoryMonitor();
        if(StorageMonitor)
            Utils.storageMonitor = new StorageMonitor();
        if(NetworkMonitor)
            Utils.networkMonitor = new NetworkMonitor();
        if(SensorsMonitor)
            Utils.sensorsMonitor = new SensorsMonitor();
        
        Utils.initializeGTop();
    }
    
    static clear() {
        try {
            Config.clearAll();
        }
        catch(e: any) {
            Utils.error(e);
        }
        
        try {
            Utils.processorMonitor?.stop();
            Utils.processorMonitor?.destroy();
            
            Utils.memoryMonitor?.stop();
            Utils.memoryMonitor?.destroy();
            
            Utils.storageMonitor?.stop();
            Utils.storageMonitor?.destroy();
            
            Utils.networkMonitor?.stop();
            Utils.networkMonitor?.destroy();
            
            Utils.sensorsMonitor?.stop();
            Utils.sensorsMonitor?.destroy();
        }
        catch(e: any) {
            Utils.error(e);
        }
        
        (Utils.processorMonitor as any) = undefined;
        (Utils.memoryMonitor as any) = undefined;
        (Utils.storageMonitor as any) = undefined;
        (Utils.networkMonitor as any) = undefined;
        (Utils.sensorsMonitor as any) = undefined;
        
        Utils.extension = undefined;
        Utils.metadata = undefined;
        Config.settings = undefined;
    }
    
    static async initializeGTop() {
        try {
            const res = await import('gi://GTop');
            Utils.GTop = res.default as any;
        } catch(e: any) {
            Utils.GTop = false;
        }
    }
    
    static get logHeader(): string {
        if(!Utils.metadata)
            return '';
        if(Utils.debug)
            return '###### ' + (Utils.metadata.name ?? '') + ' ######';
        return Utils.metadata.name ?? '';
    }
    
    static log(message: string) {
        if(Utils.debug)
            console.log(Utils.logHeader + ' ' + message);
    }
    
    static warn(message: string) {
        const error = new Error();
        console.warn(error,Utils.logHeader + ' WARNING: ' + message);
    }
    
    static error(message: string) {
        const error = new Error();
        console.error(error, Utils.logHeader + ' ERROR: ' + message);
    }
    
    static get themeStyle(): string {
        if(Config.get_string('theme-style') === 'light')
            return 'light';
        return 'dark';
    }
    
    static getMonitorsOrder(): string[] {
        let monitors = Config.get_json('monitors-order');
        if(!monitors)
            monitors = [];
        if(monitors.length < Utils.defaultMonitors.length) {
            for(const monitor of Utils.defaultMonitors) {
                if(!monitors.includes(monitor))
                    monitors.push(monitor);
            }
            Config.set('monitors-order', JSON.stringify(monitors), 'string');
        }
        return monitors;
    }
    
    static getIndicatorsOrder(category: keyof typeof Utils.defaultIndicators): string[] {
        let indicators = Config.get_json(category+'-indicators-order');
        if(!indicators)
            indicators = [];
        if(indicators.length < Utils.defaultIndicators[category].length) {
            for(const indicator of Utils.defaultIndicators[category]) {
                if(!indicators.includes(indicator))
                    indicators.push(indicator);
            }
            Config.set(category+'-indicators-order', JSON.stringify(indicators), 'string');
        }
        return indicators;
    }
    
    static hasProcStat(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/stat');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }
    
    static hasProcCpuinfo(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/cpuinfo');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }
    
    static hasProcMeminfo(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/meminfo');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }
    
    static hasProcDiskstats(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/diskstats');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }
    
    static hasProcNetDev(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/net/dev');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }
    
    static hasSensors(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('sensors -v');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasLscpu(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('lscpu -V');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasLspci(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('lspci -n');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasLsblk(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('lsblk -V');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasIp(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('ip -V');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasAMDGpu(): boolean {
        try {
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('lspci -nnk');
            if(!result || !stdout)
                return false;
            const decoder = new TextDecoder('utf8');
            const lspciOutput = decoder.decode(stdout);
            const filtered = Utils.filterLspciOutput(lspciOutput,  ['vga', 'amd'], 3);
            return Utils.GPUIsInUse(filtered, 'amd');
        } catch(e: any) {
            return false;
        }
    }
    
    static hasNVidiaGpu(): boolean {
        try {
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('lspci -nnk');
            if(!result || !stdout)
                return false;
            const decoder = new TextDecoder('utf8');
            const lspciOutput = decoder.decode(stdout);
            const filtered = Utils.filterLspciOutput(lspciOutput,  ['vga', 'nvidia'], 3);
            return Utils.GPUIsInUse(filtered, 'nvidia');
        } catch(e: any) {
            return false;
        }
    }
    
    static hasIntelGpu(): boolean {
        try {
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('lspci -nnk');
            if(!result || !stdout)
                return false;
            const decoder = new TextDecoder('utf8');
            const lspciOutput = decoder.decode(stdout);
            const filtered = Utils.filterLspciOutput(lspciOutput, ['vga', 'intel'], 3);
            return Utils.GPUIsInUse(filtered, 'intel');
        } catch(e: any) {
            return false;
        }
    }
    
    static async hasGTop(): Promise<boolean> {
        while(Utils.GTop === null)
            await new Promise(r => setTimeout(r, 100));
        return Utils.GTop !== false;
    }
    
    static filterLspciOutput(lspciOutput: string, keywords: string[], collect: number = 1): string[] {
        const lines = lspciOutput.split('\n');
        const keywordsLower = keywords.map(keyword => keyword.toLowerCase());
        const results = [];
        let collecting = 0;
    
        let result = [];
        for(let i = 0; i < lines.length; i++) {
            if(collecting === 0 && result.length > 0) {
                results.push(result.join('\n'));
                result = [];
            }
            
            if(collecting > 0) {
                result.push(lines[i]);
                collecting--;
                continue;
            }
            
            // check if the line contains all the keywords
            let containsAll = true;
            for(const keyword of keywordsLower) {
                if(!lines[i].toLowerCase().includes(keyword)) {
                    containsAll = false;
                    break;
                }
            }
            
            if(!containsAll)
                continue;
            
            result.push(lines[i]);
            collecting = collect;
            collecting--;
        }
        return results;
    }
    
    static GPUIsInUse(lspciOutputs: string[], gpu: string): boolean {
        //TODO: make this more robust:
        for(const lspciOutput of lspciOutputs) {
            const isPassthrough = lspciOutput.includes('vfio-pci');
            if(isPassthrough)
                continue;
            if(lspciOutput.toLowerCase().includes(gpu))
                return true;
        }
        return false;
    }
    
    static hasAmdGpuTop(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('amdgpu_top -V');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasRadeonTop(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('radeontop -v');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasNvidiaSmi(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('nvidia-smi -h');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasIntelGpuTop(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('intel_gpu_top -h');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static hasCoresFrequency(): boolean {
        const paths = Utils.generateCpuFreqPaths(1);
        try {
            for(const path of paths) {
                const fileContents = GLib.file_get_contents(path);
                if(!fileContents || !fileContents[0])
                    return false;
            }
        }
        catch(e) {
            return false;
        }
        return true;
    }
    
    static hasPs(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('ps -V');
            return result && stdout && !stderr.length;
        } catch(e: any) {
            return false;
        }
    }
    
    static generateCpuFreqPaths(numCores: number): string[] {
        const basePath = '/sys/devices/system/cpu/cpu';
        const freqPath = '/cpufreq/scaling_cur_freq';
        const paths = [];
        
        for(let i = 0; i < numCores; i++)
            paths.push(basePath + i + freqPath);
        return paths;
    }
    
    static unitMap = {
        'kB/s': {base: 1000, mult:1, labels: ['B/s', 'kB/s', 'MB/s', 'GB/s', 'TB/s']},
        'KiB/s': {base: 1024, mult:1, labels: ['B/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s']},
        'kb/s': {base: 1000, mult:8, labels: ['b/s', 'kb/s', 'Mb/s', 'Gb/s', 'Tb/s']},
        'Kibit/s': {base: 1024, mult:8, labels: ['bit/s', 'Kibit/s', 'Mibit/s', 'Gibit/s', 'Tibit/s']},
        'kBps': {base: 1000, mult:1, labels: ['Bps', 'kBps', 'MBps', 'GBps', 'TBps']},
        'KiBps': {base: 1024, mult:1, labels: ['Bps', 'KiBps', 'MiBps', 'GiBps', 'TiBps']},
        'Kibps': {base: 1024, mult:8, labels: ['bps', 'Kibps', 'Mibps', 'Gibps', 'Tibps']},
        'kbps': {base: 1000, mult:8, labels: ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps']},
        'Kibitps': {base: 1024, mult:8, labels: ['bitps', 'Kibitps', 'Mibitps', 'Gibitps', 'Tibitps']},
        'k ': {base: 1000, mult:1, labels: [' ', 'k', 'M', 'G', 'T']},
        'Ki': {base: 1024, mult:1, labels: ['  ', 'Ki', 'Mi', 'Gi', 'Ti']},
    };
    
    static formatBytesPerSec(value: number, unit: keyof typeof Utils.unitMap, maxNumbers: number = 2, padded: boolean = false): string {
        if(!Object.prototype.hasOwnProperty.call(Utils.unitMap, unit))
            unit = 'kB/s';
        
        if(!value || isNaN(value))
            return '-' + (padded ? '   ' : ' ') + Utils.unitMap[unit].labels[0];
        
        value *= Utils.unitMap[unit].mult;
        
        let unitIndex = 0;
        while(value >= Math.pow(10, maxNumbers) && unitIndex < Utils.unitMap[unit].labels.length - 1) {
            value /= Utils.unitMap[unit].base;
            unitIndex++;
        }
        
        //fix 100 / 1024 = 0.09765625
        if(value < 0.1)
            value = 0.1;
        
        // Convert to string and truncate to maxNumbers significant figures
        let result = value.toString();
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers) {
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            }
            else {
                result = parts[0] + '.' + parts[1].substr(0, maxNumbers - parts[0].length);
            }
        }
        else if(result.length > maxNumbers) {
            result = result.substr(0, maxNumbers);
        }
        return `${result} ${Utils.unitMap[unit].labels[unitIndex]}`;
    }
    
    static formatBytes(bytes: number, maxNumbers: number = 2): string {
        if(!bytes || isNaN(bytes))
            return '-';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        
        while(bytes >= Math.pow(10, maxNumbers) && unitIndex < units.length - 1) {
            bytes /= 1024;
            unitIndex++;
        }
        
        //fix 100 / 1024 = 0.09765625
        if(bytes < 0.1)
            bytes = 0.1;
        
        // Convert to string and truncate to maxNumbers significant figures
        let result = bytes.toString();
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers) {
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            }
            else {
                result = parts[0] + '.' + parts[1].substr(0, maxNumbers - parts[0].length);
            }
        }
        else if(result.length > maxNumbers) {
            result = result.substr(0, maxNumbers);
        }
        return `${result} ${units[unitIndex]}`;
    }
    
    static getSensorSources(): {value: any, text: string}[] {
        const sensors = [];
        
        try {
            const [_result, stdout, _stderr] = GLib.spawn_command_line_sync('sensors -j');
            
            if(stdout.length > 0) {
                const decoder = new TextDecoder('utf8');
                const stdoutString = decoder.decode(stdout);
                const parsedData = JSON.parse(stdoutString);
                
                for(const sensorName in parsedData) {
                    for(const sensor in parsedData[sensorName]) {
                        if(sensor === 'Adapter')
                            continue;
                        
                        for(const sensorData in parsedData[sensorName][sensor]) {
                            sensors.push({
                                value: {
                                    service: 'sensors',
                                    path: [sensorName, sensor, sensorData]
                                },
                                text: sensorName + ' -> ' + sensor + ' -> ' + sensorData
                            });
                        }
                    }
                }
            }
            else {
                Utils.log('No sensor data found or sensors command failed');
            }
            
            /*if(Utils.hasAMDGpu()) {
                //TODO: add support for radeontop
                if(Utils.hasAmdGpuTop()) {
                    const [result, stdout, stderr] = GLib.spawn_command_line_sync('amdgpu_top -J -n 1');
                    
                    if(stdout.length > 0) {
                        const decoder = new TextDecoder('utf8');
                        const stdoutString = decoder.decode(stdout);
                        
                        const parsedData = JSON.parse(stdoutString);
                        
                        if(parsedData.devices && parsedData.devices.length > 0) {
                            for(const gpuId in parsedData.devices) {
                                const gpu = parsedData.devices[gpuId];
                                
                                if(gpu.hasOwnProperty('Info') && gpu.Info.hasOwnProperty('DeviceName') &&
                                gpu.hasOwnProperty('Sensors')) {
                                    for(const sensor in gpu.Sensors) {
                                        Utils.log('sensor: ' + sensor);
                                        sensors.push({
                                            value: {
                                                service: 'amdgpu_top',
                                                path: [gpuId, sensor]
                                            },
                                            text: gpu.Info.DeviceName + ' -> ' + sensor
                                        });
                                    }
                                }
                            }
                        }
                    }
                    else {\   
                        Utils.log('No AMD GPU data found or amdgpu_top command failed');
                    }
                }
            }*/
        } catch(e: any) {
            Utils.log('Error getting sensors sources: ' + e);
        }
        
        return sensors;
    }
    
    static inferMeasurementUnit(key: string): string {
        if(key.startsWith('temp'))
            return '°C';
        if(key.startsWith('fan'))
            return 'RPM';
        if(key.startsWith('in'))
            return 'V';
        if(key.startsWith('power'))
            return 'W';
        if(key.startsWith('curr'))
            return 'A';
        if(key.startsWith('energy'))
            return 'J';
        return '';
    }
    
    static sensorsNameFormat(name: string): string {
        return Utils.capitalize(name.replace(/_/g, ' '));
    }
    
    static isNumeric(value: string|number): boolean {
        if(typeof value === 'number')
            return !isNaN(value);
        if(typeof value === 'string')
            return value.trim() !== '' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
        return false;
    }
    
    static isIntOrIntString(value: string|number): boolean {
        if(Number.isInteger(value))
            return true;
        if(typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return parsed.toString() === value;
        }
        return false;
    }
    
    static celsiusToFahrenheit(celsius: number) {
        return celsius * 1.8 + 32;
    }
    
    static extractCommandName(cmdLine: string): string {
        if(cmdLine.trim().startsWith('[') && cmdLine.trim().endsWith(']'))
            return cmdLine.trim();
        
        // eslint-disable-next-line no-control-regex
        const sanitizedCmdLine = cmdLine.replace(/\u0000/g, ' ');
        const elements = sanitizedCmdLine.split(' ');
        const fullPath = elements[0];
        const pathParts = fullPath.split('/');
        const commandName = pathParts[pathParts.length - 1];
        return commandName.replace(/[\r\n]/g, '');
    }
    
    static parseSize(size: string): number {
        const sizeRegex = /^([\d,.]+)([KMGTP]?)$/;
        const match = sizeRegex.exec(size);
        
        if(!match)
            return Number.NaN;
        
        const value = parseFloat(match[1].replace(',', '.'));
        const unit = match[2].toLowerCase();
        
        if(Number.isNaN(value))
            return Number.NaN;
        
        switch(unit) {
            case 'k':
                return Math.round(value * 1024);
            case 'm':
                return Math.round(value * 1024 * 1024);
            case 'g':
                return Math.round(value * 1024 * 1024 * 1024);
            case 't':
                return Math.round(value * 1024 * 1024 * 1024 * 1024);
            default:
                return value;
        }
    }
    
    static getVendorName(vendorId: string): string[] {
        const vendors = {
            '0x1002': ['AMD'],                  // AMD (Advanced Micro Devices, Inc.) - Major GPU and CPU manufacturer
            '0x10de': ['NVIDIA'],               // NVIDIA Corporation - Prominent GPU manufacturer known for GeForce series
            '0x8086': ['Intel'],                // Intel Corporation - Renowned CPU manufacturer and maker of integrated graphics
            '0x102b': ['Matrox'],               // Matrox Electronic Systems Ltd. - Manufacturer of specialized graphics solutions
            '0x1039': ['SiS'],                  // Silicon Integrated Systems (SiS) - Company producing a variety of hardware, including GPUs
            '0x5333': ['S3'],                   // S3 Graphics, Ltd. - Producer of graphics hardware, known for older video cards
            '0x1a03': ['ASPEED'],               // ASPEED Technology, Inc. - Maker of server management and embedded graphics solutions
            '0x80ee': ['Oracle', 'VirtualBox'], // Oracle VirtualBox - Identifier used for VirtualBox's virtual graphics adapter
            '0x1234': ['Bochs', 'QEMU'],        // Bochs/QEMU - Common ID for virtual GPUs in Bochs or QEMU environments
            '0x15ad': ['VMware'],               // VMware - Identifier for VMware's virtual graphics devices
            '0x1414': ['Microsoft', 'HyperV'],  // Microsoft Hyper-V - ID for virtual GPUs in Microsoft's Hyper-V virtualization
            '0x1013': ['Cirrus', 'Logic'],      // Cirrus Logic - A hardware manufacturer known for producing graphics chips in the past
            '0x12d2': ['NVIDIA'],               // NVIDIA (early products) - Identifier for some of NVIDIA's early graphics products
            '0x18ca': ['XGI'],                  // XGI Technology Inc. - A former graphics chipset manufacturer
            '0x1de1': ['Tekram'],               // Tekram Technology Co., Ltd. - A company known for various computer hardware, including graphics
        };
        return vendors[vendorId as keyof typeof vendors] || ['Unknown'];
    }
    
    static lspciCached?: GpuInfo[];
    static getGPUsList(): GpuInfo[] {
        if(!Utils.lspciCached) {
            Utils.lspciCached = [];
            try {
                const decoder = new TextDecoder('utf8');
                
                // Cannot use -mm because it doesn't show the driver and module
                const [result, stdout, stderr] = GLib.spawn_command_line_sync('lspci -nnk');
                if(!result || !stdout) {
                    const lspciError = decoder.decode(stderr);
                    Utils.error('Error getting GPUs list: ' + lspciError);
                    return Utils.lspciCached;
                }
                
                const lspciOutput = decoder.decode(stdout);
                
                const filteredOutputs = Utils.filterLspciOutput(lspciOutput, ['vga'], 5);
                
                for(const filtered of filteredOutputs) {
                    // remove unrelated lines and tabs
                    const lines = filtered.split('\n');
                    for(let i = lines.length - 1; i >= 1; i--) {
                        if(lines[i].startsWith('\t'))
                            lines[i] = lines[i].substring(1);
                        else
                            lines.splice(i, lines.length - i);
                    }
                    
                    // parse address
                    let firstLine = lines[0];
                    const addressRegex = /^([0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.([0-9a-fA-F]) /;
                    const addressMatch = addressRegex.exec(firstLine);
                    if(!addressMatch) {
                        Utils.warn('Error getting GPUs list: ' + firstLine + ' does not match address');
                        continue;
                    }
                    const [domain, bus, slot] = [addressMatch[1], addressMatch[2], addressMatch[3]];
                    firstLine = firstLine.replace(addressRegex, '');
                    
                    // parse vendor and model
                    const vendorLine = firstLine.split(':');
                    if(vendorLine.length < 3) {
                        Utils.warn('Error getting GPUs list: ' + firstLine + ' does not match vendor');
                        continue;
                    }
                    vendorLine.shift();
                    
                    let vendor = vendorLine.join(':').trim();
                    const regex = /\[([\da-fA-F]{4}):([\da-fA-F]{4})\]\s*/g;
                    
                    let match;
                    let vendorId = null;
                    let productId = null;
                    
                    if((match = regex.exec(vendor)) !== null) {
                        vendorId = match[1];
                        productId = match[2];
                    }
                    vendor = vendor.replace(regex, '').trim();
                    
                    if(lines.length < 2) {
                        Utils.warn('Error getting GPUs list: lines length < 2');
                        continue;
                    }
                    const modelLine = lines[1].split(':');
                    if(modelLine.length < 2) {
                        Utils.warn('Error getting GPUs list: model line missmatch');
                        continue;
                    }
                    modelLine.shift();
                    let model = modelLine.join(':').trim();
                    model = model.replace(regex, '').trim();
                    
                    // parse drivers and modules
                    let drivers = null;
                    if(lines.length >= 3) {
                        const driverLine = lines[2].split(':');
                        if(driverLine.length >= 2) {
                            driverLine.shift();
                            drivers = driverLine.join(':').split(',').map(line => line.trim());
                        }
                    }
                    
                    let modules = null;
                    if(lines.length >= 4) {
                        const moduleLine = lines[3].split(':');
                        if(moduleLine.length >= 2) {
                            moduleLine.shift();
                            modules = moduleLine.join(':').split(',').map(line => line.trim());
                        }
                    }
                    
                    // add to cached list
                    const gpu: GpuInfo = {
                        domain,
                        bus,
                        slot,
                        vendor,
                        model,
                    };
                    
                    if(vendorId)
                        gpu.vendorId = vendorId;
                    if(productId)
                        gpu.productId = productId;
                    if(drivers)
                        gpu.drivers = drivers;
                    if(modules)
                        gpu.modules = modules;
                    
                    Utils.lspciCached.push(gpu);
                }
            } catch(e: any) {
                Utils.log('Error getting GPUs list: ' + e.message);
            }
        }
        return Utils.lspciCached;
    }
    
    static getGPUModelName(gpu: GpuInfo): string {
        let shortName = Utils.GPUModelShortify(gpu.model);
        const vendorNames = Utils.getVendorName('0x' + gpu.vendorId);
        
        if(vendorNames[0] === 'Unknown')
            return shortName;
        
        const normalizedShortName = shortName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if(!vendorNames.some(vendorName => normalizedShortName.includes(vendorName.toLowerCase()))) {
            const shortVendorName = Utils.GPUModelShortify(gpu.vendor);
            const normalizedVendorName = shortVendorName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();            
            if(shortVendorName && vendorNames.some(vendorName => normalizedVendorName.includes(vendorName.toLowerCase())))
                shortName = shortVendorName + ` [${shortName}]`;
            else
                shortName = vendorNames.join(' / ') + ` ${shortName}`;
        }
        return shortName;
    }
    
    static GPUModelShortify(model: string): string {
        // replace ','
        model = model.replace(',', '');
        
        // replace '(R)'
        model = model.replace('(R)', '');
        
        // replace 'Inc.'
        model = model.replace(/\bInc\./g, '');
        
        // replace 'Corp.'
        model = model.replace(/\bCorp\./g, '');
        
        // replace 'Co.'
        model = model.replace(/\bCo\./g, '');
        
        // replace 'Co'
        model = model.replace(/\bCo\b/g, '');
        
        // replace 'Corporation'
        model = model.replace(/\bCorporation\b/g, '');
        
        // replace 'Incorporated'
        model = model.replace(/\bIncorporated\b/g, '');
        
        // replace 'Limited'
        model = model.replace(/\bLimited\b/g, '');
        
        // replace 'Ltd'
        model = model.replace(/\bLtd\b/g, '');
        
        // replace 'Company'
        model = model.replace(/\bCompany\b/g, '');
        
        // replace 'International'
        model = model.replace(/\bInternational\b/g, '');
        
        // replace 'Group'
        model = model.replace(/\bGroup\b/g, '');
        
        // replace 'Technologies'
        model = model.replace(/\bTechnologies\b/g, '');
        
        // replace 'Technology'
        model = model.replace(/\bTechnology\b/g, '');
        
        // replace 'Integrated Systems'
        model = model.replace(/\bIntegrated Systems\b/g, '');
        
        // replace 'Computers'
        model = model.replace(/\bComputers\b/g, '');
        
        // replace 'Computer'
        model = model.replace(/\bComputer\b/g, '');
        
        // replace 'Electronic'
        model = model.replace(/\bElectronic\b/g, '');
        
        // replace 'Advanced Micro Devices' with 'AMD'
        model = model.replace(/\bAdvanced Micro Devices\b/g, 'AMD');
        
        // replace 'Devices'
        model = model.replace(/\bDevices\b/g, '');
        
        // replace 'Device'
        model = model.replace(/\bDevice\b/g, '');
        
        // replace '[AMD/ATI]'
        model = model.replace('[AMD/ATI]', '');
        
        //replace 'ASUSTeK' with 'ASUS'
        model = model.replace(/\bASUSTeK\b/g, 'ASUS');
        
        // replace 'Hewlett-Packard' with 'HP'
        model = model.replace(/\bHewlett-Packard\b/g, 'HP');
        
        // replace (rev 00)
        model = model.replace(/\(rev\.?\s?\w+\)/g, '');
        
        // replace multiple spaces with single space
        model = model.replace(/\s+/g, ' ');
        
        // replace repeated words
        model = model.replace(/\b(\w+)\s+\1\b/g, '$1');
        
        // trim
        model = model.trim();
        
        return model;
    }
    
    static getSelectedGPU(): GpuInfo|undefined {
        const selected = Config.get_json('processor-menu-gpu');
        if(!selected)
            return;
        
        const gpus = Utils.getGPUsList();
        for(const gpu of gpus) {
            if(gpu.domain === selected.domain && gpu.bus === selected.bus && gpu.slot === selected.slot &&
                gpu.vendorId === selected.vendorId && gpu.productId === selected.productId)
                return gpu;
        }
        return;
    }
    
    static cachedUptimeSeconds: number = 0; 
    static uptimeTimer: number = 0;
    static getUptime(callback: (uptime: number) => void): UptimeTimer {
        const syncTime = () => {
            if(Utils.uptimeTimer)
                GLib.source_remove(Utils.uptimeTimer);
            Utils.cachedUptimeSeconds = 0;
            
            try {
                const fileContents = GLib.file_get_contents('/proc/uptime');
                if(fileContents && fileContents[0]) {
                    const decoder = new TextDecoder('utf8');
                    const uptimeString = decoder.decode(fileContents[1]);
                    const uptimeSeconds = parseFloat(uptimeString.split(' ')[0]);
                    Utils.cachedUptimeSeconds = uptimeSeconds;
                }
            }
            catch(e) { /* empty */ }
            
            callback(Utils.cachedUptimeSeconds);
            
            Utils.uptimeTimer = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                1000,
                () => {
                    Utils.cachedUptimeSeconds += 1.0;
                    callback(Utils.cachedUptimeSeconds);
                    return true;
                }
            );
        };
        syncTime();
        
        return {
            stop: () => {
                if(Utils.uptimeTimer !== 0) {
                    GLib.source_remove(Utils.uptimeTimer);
                    Utils.uptimeTimer = 0;
                }
            }
        };
    }
    
    static formatUptime(seconds: number): string {
        const timeParts = {
            days: Math.floor(seconds / (3600 * 24)),
            hours: Math.floor(seconds % (3600 * 24) / 3600),
            minutes: Math.floor(seconds % 3600 / 60),
            seconds: Math.floor(seconds % 60)
        };
        
        const formatPart = (value: number, isPadded: boolean) => isPadded ? value.toString().padStart(2, '0') : value.toString();
        
        let formattedTime = '';
        let shouldPad = false;
        
        if(timeParts.days > 0) {
            formattedTime += `${timeParts.days}d `;
            shouldPad = true;
        }
        if(timeParts.hours > 0 || shouldPad) {
            formattedTime += `${formatPart(timeParts.hours, shouldPad)}h `;
            shouldPad = true;
        }
        if(timeParts.minutes > 0 || shouldPad) {
            formattedTime += `${formatPart(timeParts.minutes, shouldPad)}m `;
            shouldPad = true;
        }
        formattedTime += `${formatPart(timeParts.seconds, shouldPad)}s`;
    
        return formattedTime.trim();
    }
    
    static capitalize(str: string, lower: boolean = true) {
        if(!str)
            return str;
        if(lower)
            str = str.toLowerCase();
        return str.replace(/\b[a-z]/g, (letter) => {
            return letter.toUpperCase();
        });
    }
    
    static listDisksSync(): Map<string, DiskInfo> {
        const disks = new Map<string, DiskInfo>();
        
        try {
            const [_result, stdout, _stderr] = GLib.spawn_command_line_sync('lsblk -J -o ID,NAME,LABEL,MOUNTPOINTS,PATH');
            
            if(stdout.length > 0) {
                const decoder = new TextDecoder('utf8');
                const stdoutString = decoder.decode(stdout);
                const parsedData = JSON.parse(stdoutString);
                
                const findDevice = (device: DiskInfo) => {
                    if(Object.prototype.hasOwnProperty.call(device, 'children') && device.children && device.children.length > 0) {
                        for(const child of device.children)
                            findDevice(child);
                    }
                    else {
                        disks.set(device.id, device);
                    }
                };
                
                if(parsedData.blockdevices && parsedData.blockdevices.length > 0) {
                    for(const device of parsedData.blockdevices) {
                        findDevice(device);
                    }
                }
            }
            else {
                Utils.log('No disk data found or lsblk command failed');
            }
        } catch(e: any) {
            Utils.log('Error getting disk list: ' + e);
        }
        
        return disks;
    }
    
    static async listDisksAsync(): Promise<Map<string, DiskInfo>> {
        const disks = new Map<string, DiskInfo>();
        
        try {
            const result = await Utils.executeCommandAsync('lsblk -J -o ID,NAME,LABEL,MOUNTPOINTS,PATH');
            if(result) {
                const parsedData = JSON.parse(result);
                
                const findDevice = (device: DiskInfo) => {
                    if(Object.prototype.hasOwnProperty.call(device, 'children') && device.children && device.children.length > 0) {
                        for(const child of device.children)
                            findDevice(child);
                    }
                    else {
                        disks.set(device.id, device);
                    }
                };
                
                if(parsedData.blockdevices && parsedData.blockdevices.length > 0) {
                    for(const device of parsedData.blockdevices) {
                        findDevice(device);
                    }
                }
            }
            else {
                Utils.error('No disk data found or lsblk command failed');
            }
        } catch(e: any) {
            Utils.error('Error getting disk list: ' + e);
        }
        return disks;
    }
    
    static findDefaultDisk(disks: Map<string, DiskInfo>): string|null {
        for(const [id, disk] of disks.entries()) {
            if(disk.mountpoints && Array.isArray(disk.mountpoints) && disk.mountpoints.length > 0 && disk.mountpoints.includes('/')) {
                return id;
            }
        }
        if(disks.size > 0)
            return disks.keys().next().value;
        return null;
    }
    
    static movingAverage(points: number[][], size: number) {
        const smoothedPoints = new Array(points.length);
        let sum = 0;
        let count = 0;
        let avg;
        
        for(let i = 0; i < points.length; i++) {
            const point = points[i][1];
            
            sum += point;
            count++;
            
            if(i >= size) {
                sum -= points[i - size][1];
            }
            else {
                avg = sum / count;
                smoothedPoints[i] = [points[i][0], avg];
                continue;
            }
            
            avg = sum / size;
            smoothedPoints[i] = [points[i][0], avg];
        }

        return smoothedPoints;
    }
    
    static readDirAsync(path: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            // Check if the path is valid and not empty
            if(!path || typeof path !== 'string') {
                reject(new Error('Invalid directory path'));
                return;
            }
            
            let dir;
            try {
                dir = Gio.File.new_for_path(path);

                // Check if the directory exists
                // This is blocking, no need to check
                /*if(!dir.query_exists(null)) {
                    reject(new Error('Directory does not exist'));
                    return;
                }*/
            } catch(e: any) {
                reject(new Error(`Error creating directory object: ${e.message}`));
                return;
            }

            dir.enumerate_children_async('standard::name', Gio.FileQueryInfoFlags.NONE, 0, null, (sourceObject, result) => {
                try {
                    const enumerator = sourceObject.enumerate_children_finish(result);
                    
                    let fileInfo;
                    const files = [];
                    
                    while((fileInfo = enumerator.next_file(null)) !== null) {
                        const name = fileInfo.get_name();
                        files.push(name);
                    }
                    resolve(files);
                } catch(e: any) {
                    reject(new Error(`Error reading directory: ${e.message}`));
                }
            });
        });
    }
    
    static readFileAsync(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Check if the path is valid and not empty
            if(!path || typeof path !== 'string') {
                reject(new Error('Invalid file path'));
                return;
            }
            
            let file;
            try {
                file = Gio.File.new_for_path(path);

                // Check if the file exists
                // This is blocking, no need to check
                /*if(!file.query_exists(null)) {
                    reject(new Error('File does not exist'));
                    return;
                }*/
            } catch(e: any) {
                reject(new Error(`Error creating file object: ${e.message}`));
                return;
            }

            file.load_contents_async(null, (sourceObject, res) => {
                try {
                    const [success, fileContent] = sourceObject.load_contents_finish(res);

                    // Check if the file read was successful
                    if(!success) {
                        reject(new Error('Failed to read file'));
                        return;
                    }

                    if(fileContent.length === 0) {
                        reject(new Error('File is empty'));
                        return;
                    }

                    // Decode the file content
                    const decoder = new TextDecoder('utf8');
                    resolve(decoder.decode(fileContent));
                } catch(e: any) {
                    reject(new Error(`Error reading file: ${e.message}`));
                }
            });
        });
    }
    
    static executeCommandAsync(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let argv;
            try {
                // Parse the command line to properly create an argument vector
                argv = GLib.shell_parse_argv(command);
                if(!argv[0]) {
                    throw new Error('Invalid command');
                }
            } catch(e: any) {
                // Handle errors in command parsing
                reject(new Error(`Failed to parse command: ${e.message}`));
                return;
            }
    
            // Create a new subprocess
            const proc = new Gio.Subprocess({
                argv: argv[1],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
    
            // Initialize the subprocess
            try {
                proc.init(null);
            } catch(e: any) {
                // Handle errors in subprocess initialization
                reject(new Error(`Failed to initialize subprocess: ${e.message}`));
                return;
            }
    
            // Communicate with the subprocess asynchronously
            proc.communicate_utf8_async(null, null, (proc: Gio.Subprocess, res: Gio.AsyncResult) => {
                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if(proc.get_exit_status() !== 0) {
                        if(!stderr)
                            throw new Error('No error output');
                        reject(new Error(`Command failed with error: ${stderr.trim()}`));
                        return;
                    }
                    if(!stdout)
                        throw new Error('No output');
                    resolve(stdout.trim());
                } catch(e: any) {
                    reject(new Error(`Failed to communicate with subprocess: ${e.message}`));
                }
            });
        });
    }
    
    static getLocalIcon(icon_name: string): Gio.Icon|null {
        if(!Utils.metadata || !(Utils.metadata as any).path)
            return null;
        return Gio.icon_new_for_string(`${(Utils.metadata as any).path}/icons/hicolor/scalable/actions/${icon_name}.svg`);
    }
    
    /**
     * This function is sync, but it spawns only once the user opens the network menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~15ms: relevant but not a priority
     */
    static getNetworkInterfacesSync(): Map<string, InterfaceInfo> {
        const devices = new Map<string, InterfaceInfo>();
        
        if(!Utils.hasIp())
            return devices;
        
        try {
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('ip -d -j addr');
            
            if(result && stdout) {
                const decoder = new TextDecoder('utf8');
                const output = decoder.decode(stdout);
                
                const json = JSON.parse(output);
                
                for(const data of json) {
                    const name = data.ifname;
                    if(name === 'lo')
                        continue;
                    
                    const flags = data.flags || [];
                    if(flags.includes('NO-CARRIER') || flags.includes('LOOPBACK'))
                        continue;
                    
                    const ifindex = data.ifindex;
                    if(data.ifindex === undefined)
                        continue;
                    
                    const device: InterfaceInfo = {
                        name,
                        flags,
                        ifindex
                    };
                    
                    if(data.mtu)
                        device.mtu = data.mtu;
                    if(data.qdisc)
                        device.qdisc = data.qdisc;
                    if(data.operstate)
                        device.operstate = data.operstate;
                    if(data.linkmode)
                        device.linkmode = data.linkmode;
                    if(data.group)
                        device.group = data.group;
                    if(data.txqlen)
                        device.txqlen = data.txqlen;
                    if(data.link_type)
                        device.link_type = data.link_type;
                    if(data.address)
                        device.address = data.address;
                    if(data.broadcast)
                        device.broadcast = data.broadcast;
                    if(data.netmask)
                        device.netmask = data.netmask;
                    if(data.altnames)
                        device.altnames = data.altnames;
                    if(data.addr_info)
                        device.addr_info = data.addr_info;
                    if(data.linkinfo)
                        device.linkinfo = data.linkinfo;
                    
                    devices.set(name, device);
                }
            }
        }
        catch(e: any) {
            Utils.error(e.message);
        }
        
        return devices;
    }
    
    /**
     * This function is sync, but it spawns only once the user opens the storage menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~25ms: relevant but not a priority
     */
    static getBlockDevicesSync(): Map<string, BlockDevice> {
        const devices = new Map();
        
        try {
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('lsblk -Jb -o ID,UUID,NAME,KNAME,PKNAME,LABEL,TYPE,SUBSYSTEMS,MOUNTPOINTS,VENDOR,MODEL,PATH,RM,RO,STATE,OWNER,SIZE,FSUSE%,FSTYPE');
            
            if(result && stdout) {
                const decoder = new TextDecoder('utf8');
                const output = decoder.decode(stdout);
                
                const json = JSON.parse(output);
                
                const processDevice = (device: any, parent: BlockDevice|null = null) => {
                    const id = device.id;
                    if(!id)
                        return;
                    
                    if(devices.has(id)) {
                        if(parent)
                            devices.get(id).parents.push(parent);
                        return;
                    }
                    
                    const uuid = device.uuid;
                    const name = device.name;
                    const kname = device.kname;
                    const pkname = device.pkname;
                    const label = device.label;
                    const type = device.type;
                    
                    if(type === 'loop')
                        return;
                    
                    const subsystems = device.subsystems;
                    
                    let mountpoints: string[] = [];
                    if(device.mountpoints && device.mountpoints.length > 0 && device.mountpoints[0])
                        mountpoints = device.mountpoints;
                    
                    const vendor = device.vendor?.trim();
                    const model = device.model?.trim();
                    const path = device.path;
                    const removable = device.rm;
                    const readonly = device.ro;
                    const state = device.state;
                    const owner = device.owner;
                    const size = device.size;
                    const usage = parseInt(device['fsuse%'], 10);
                    const filesystem = device.fstype;
                    
                    const deviceObj: BlockDevice = {
                        id,
                        uuid,
                        name,
                        kname,
                        pkname,
                        label,
                        type,
                        subsystems,
                        mountpoints,
                        vendor,
                        model,
                        path,
                        removable,
                        readonly,
                        state,
                        owner,
                        size,
                        usage,
                        filesystem,
                        parents: [],
                    };
                    
                    if(parent) {
                        deviceObj.parents.push(parent);
                    }
                    
                    if(device.children && device.children.length > 0) {
                        for(const child of device.children) {
                            processDevice(child, deviceObj);
                        }
                    }
                    else {
                        devices.set(id, deviceObj);
                    }
                };
                
                for(const device of json.blockdevices) {
                    processDevice(device);
                }
            }
        }
        catch(e: any) {
            Utils.error(e);
        }
        
        return devices;
    }
    
    static parseRGBA(colorString: string): Color {
        const color: Color = { red: 0, green: 0, blue: 0, alpha: 1 };
    
        if(colorString.startsWith('#')) {
            colorString = colorString.substring(1);
            if(colorString.length === 3) {
                colorString = colorString.split('').map(char => char + char).join('');
            }
            if(colorString.length === 6 || colorString.length === 8) {
                color.red = parseInt(colorString.substring(0, 2), 16) / 255;
                color.green = parseInt(colorString.substring(2, 4), 16) / 255;
                color.blue = parseInt(colorString.substring(4, 6), 16) / 255;
                if(colorString.length === 8) {
                    color.alpha = parseInt(colorString.substring(6, 8), 16) / 255;
                }
            }
            else {
                throw new Error('Invalid hex color format');
            }
        }
        else if(colorString.toLowerCase().startsWith('rgb')) {
            const match = colorString.match(/\d+(\.\d+)?/g);
            if(!match)
                throw new Error('Invalid RGB(A) format');
            const values = match.map(Number);
            if(values.length === 3 || values.length === 4) {
                color.red = values[0] / 255;
                color.green = values[1] / 255;
                color.blue = values[2] / 255;
                if(values.length === 4) {
                    color.alpha = values[3];
                }
                if(values.some((value, index) => (index < 3 && (value < 0 || value > 255)) || (index === 3 && (value < 0 || value > 1)))) {
                    throw new Error('RGB values must be between 0 and 255, and alpha value must be between 0 and 1');
                }
            }
            else {
                throw new Error('Invalid RGB(A) format');
            }
        }
        else {
            throw new Error('Invalid color format');
        }
        return color;
    }
    
    static valueTreeExtimatedHeight(valueTree: Map<string,string[]>): number {
        let length = valueTree.size;
        for(const value of valueTree.values())
            length += value.length;
        return length *= 20;
    }
}
