import { Component, HostListener, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Mapping } from '../../../../shared/model/mapping';
import { Buttons } from '../../../../shared/model/buttons';
import { Coordinates } from '../../../../shared/model/coordinates';
import { CirclePad } from '../../../../shared/model/circle-pad';
import { saveAs } from 'file-saver';
import { RehidConfig, RehidMapping } from '../model/rehid-config';
import { BoundingCoordinates } from 'shared/model/bounding-coordinates';

@Component({
  selector: 'builder-config',
  templateUrl: './builder-config.component.html',
  styleUrls: ['./builder-config.component.css']
})
export class BuilderConfigComponent implements OnInit {

  buttonMappings = new Array<Mapping<Buttons, Buttons>>();
  touchscreenMappings = new Array<Mapping<Buttons, Coordinates>>();
  cpadMappings = new Array<Mapping<Buttons, CirclePad>>();
  touchToKeyMappings = new Array<Mapping<BoundingCoordinates, Buttons>>();
  building = false;
  rehidMode = true;
  dpadtocpad = false;
  cpadtodpad = false;
  overridecpadpro = false;
  homeButtonCombo = new Buttons();

  constructor(private modalService: NgbModal) { }

  ngOnInit() {
  }

  cPadDpadExclusive(opt: string) {
    if (opt === 'cpad' && this.cpadtodpad && this.dpadtocpad) {
      this.dpadtocpad = false;
    } else if (opt === 'dpad' && this.dpadtocpad && this.cpadtodpad) {
      this.cpadtodpad = false;
    }
  }

  openModal(content: any) {
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  private rehidConfigAsString(): string {
    return JSON.stringify(this.buildRehidConfig(), (k, v) => {
      if ((typeof v === 'boolean' && !v) || (Array.isArray(v) && v.length === 0)) {
        return undefined;
      } else {
        return v;
      }
    });
  }

  private buildRehidConfig(): RehidConfig {
    const rehid = new RehidConfig();
    this.buttonMappings.forEach(m => {
      rehid.keys.push(new RehidMapping(m.input.toRehid(), m.output.toRehid()));
    });
    this.touchscreenMappings.forEach(m => {
      rehid.touch.push(new RehidMapping(m.input.toRehid(), m.output.toRehid()));
    });
    this.cpadMappings.forEach(m => {
      rehid.cpad.push(new RehidMapping(m.input.toRehid(), m.output.toRehid()));
    });
    this.touchToKeyMappings.forEach(m => {
      rehid.touchtokeys.push(new RehidMapping(m.input.toRehid(), m.output.toRehid()));
    });
    rehid.cpadtodpad = this.cpadtodpad;
    rehid.dpadtocpad = this.dpadtocpad;
    rehid.overridecpadpro = this.overridecpadpro;
    if (this.homeButtonCombo.toRehid() !== '') {
      rehid.homebutton = this.homeButtonCombo.toRehid();
    }
    return rehid;
  }

  buildCurrent() {
    this.building = true;
    console.log(this.homeButtonCombo.toRehid());
    if (this.rehidMode) {
      const file = new Blob([this.rehidConfigAsString()], { type: 'application/json;charset=utf-8' });
      saveAs(file, 'rehid.json');
      this.building = false;
    }
  }

  importRemap(event) {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    this.loadRemapFile(file);
    event.target.value = '';
  }

  @HostListener('document:dragover', ['$event'])
  onDocumentDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  @HostListener('document:drop', ['$event'])
  onDocumentDrop(event: DragEvent) {
    event.preventDefault();
    const dt = event.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) {
      return;
    }
    const file = dt.files[0];
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('只支持导入 JSON 文件');
      return;
    }
    const ok = confirm(`检测到拖拽文件 "${file.name}"，是否导入并覆盖当前配置？`);
    if (!ok) {
      return;
    }
    this.loadRemapFile(file);
  }

  private loadRemapFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as RehidConfig;
        this.buttonMappings = [];
        this.touchscreenMappings = [];
        this.cpadMappings = [];
        this.touchToKeyMappings = [];

        if (parsed.cpadtodpad !== undefined) { this.cpadtodpad = parsed.cpadtodpad; }
        if (parsed.dpadtocpad !== undefined) { this.dpadtocpad = parsed.dpadtocpad; }
        if (parsed.overridecpadpro !== undefined) { this.overridecpadpro = parsed.overridecpadpro; }
        if (parsed.homebutton) { this.homeButtonCombo = this.buttonsFromRehid(parsed.homebutton); }

        const keys = parsed.keys || [];
        keys.forEach(r => {
          const inB = this.buttonsFromRehid(r.press);
          const outB = this.buttonsFromRehid(r.get);
          this.buttonMappings.push(new Mapping(inB, outB));
        });

        const touch = parsed.touch || [];
        touch.forEach(r => {
          const inB = this.buttonsFromRehid(r.press);
          const outC = this.coordinatesFromRehid(r.get);
          this.touchscreenMappings.push(new Mapping(inB, outC));
        });

        const cpad = parsed.cpad || [];
        cpad.forEach(r => {
          const inB = this.buttonsFromRehid(r.press);
          const outCp = this.circlePadFromRehid(r.get);
          this.cpadMappings.push(new Mapping(inB, outCp));
        });

        const touchtokeys = parsed.touchtokeys || [];
        touchtokeys.forEach(r => {
          const inBounds = this.boundingFromRehid(r.press);
          const outB = this.buttonsFromRehid(r.get);
          this.touchToKeyMappings.push(new Mapping(inBounds, outB));
        });

      } catch (e) {
        alert('Failed to parse remap file: ' + e);
      }
    };
    reader.readAsText(file);
  }

  private buttonsFromRehid(v: string | number[]): Buttons {
    const b = new Buttons();
    const valid = new Set([
      'l', 'r', 'up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'start', 'select', 'zl', 'zr',
      'cup', 'cdown', 'cleft', 'cright', 'csup', 'csdown', 'csleft', 'csright'
    ]);
    if (typeof v === 'string') {
      v.split('+').map(t => t.trim()).filter(t => t.length > 0).forEach(token => {
        const prop = token.toLowerCase();
        if (valid.has(prop)) {
          // @ts-ignore
          b[prop] = true;
        }
      });
    }
    return b;
  }

  private coordinatesFromRehid(v: string | number[]): Coordinates {
    if (Array.isArray(v) && v.length >= 2) {
      const x = v[0];
      const y = 240 - v[1];
      return new Coordinates(x, y);
    }
    return new Coordinates();
  }

  private circlePadFromRehid(v: string | number[]): CirclePad {
    const cp = new CirclePad(100);
    if (Array.isArray(v) && v.length >= 2) {
      const rx = v[0];
      const ry = v[1];
      const percentX = (rx * (50 / 190)) + 50;
      const percentY = (ry * (50 / 190)) + 50;
      cp.setXPercent(percentX);
      cp.setYPercent(percentY);
    }
    return cp;
  }

  private boundingFromRehid(v: string | number[]): BoundingCoordinates {
    if (Array.isArray(v) && v.length >= 4) {
      const x = v[0];
      const y = v[1];
      const h = v[2];
      const w = v[3];
      return new BoundingCoordinates(x, y, w, h);
    }
    return new BoundingCoordinates();
  }
}
