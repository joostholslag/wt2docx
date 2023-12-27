import { FormElement } from "./FormElement";
import { WebTemplate } from "./WebTemplate";
import {
  formatOccurrences,
  isAnyChoice,
  isDataValue,
  isDisplayableNode,
  isEntry,
  isEvent,
  isSection
} from "./isEntry";
import { StringBuilder } from "./StringBuilder";
import {  Workbook } from "xmind";

import { TemplateInput } from "./TemplateInput";
import { Config } from "./Config";
import rmDescriptions from "../resources/rm_descriptions.json";
import {
  ExportFormat,
  formatAnnotations,
  formatCluster, formatCompositionContextHeader,
  formatCompositionHeader,
  formatElement,
  formatLeafHeader,
  formatNodeContent,
  formatNodeFooter,
  formatNodeHeader,
  formatObservationEvent,
  formatTemplateHeader,
  formatUnsupported
} from "./DocFormatter";
import {
  formatDvCodedText,
  formatDvCount,
  formatDvDefault,
  formatDvOrdinal,
  formatDvQuantity,
  formatDvText
} from "./TypeFormatter";


export class DocBuilder {

  sb: StringBuilder = new StringBuilder();
  wb: Workbook = new Workbook()

  defaultLang: string = 'en';
  config: Config;
  exportFormat: ExportFormat
  outFileDir: string;

  readonly _wt: WebTemplate;

  constructor(wt: WebTemplate, config: Config, exportFormatString: string, outFileDir: string) {
    this._wt = wt;
    this.defaultLang = wt.defaultLanguage;
    this.config = config;
    this.exportFormat = ExportFormat[exportFormatString];
    this.outFileDir = outFileDir
    this.generate();
  }

  public toString(): string {
    return this.sb.toString();
  }

  get wt(): WebTemplate {
    return this._wt;
  }

  private generate() {
    formatTemplateHeader(this)
    this.walkComposition(this._wt.tree);
  }

  private walkChildren(f: FormElement, nonContextOnly: boolean = false) {
    if (f.children) {
      f.children.forEach((child) => {
        child.parentNode = f;
        if (!nonContextOnly || (nonContextOnly && !child.inContext)) {
          this.walk(child)
        }
      });
    }
  }

  private walkNonRMChildren(f: FormElement) {
    this.walkChildren(f, true)
  }

  private walk(f: FormElement) {
    if (isEntry(f.rmType)) {
      this.walkEntry(f)
    } else if (isDataValue(f.rmType)) {
      this.walkElement(f, false)
    } else if (isSection(f.rmType)) {
      this.walkSection(f)
    } else if (f.rmType === 'ELEMENT') {
      formatElement(this,f)
    } else if (f.rmType === 'CLUSTER') {
      this.walkCluster(f);
    } else if (isEvent(f.rmType)) {
      this.walkEvent(f)
    } else {
      switch (f.rmType) {

        //      case 'ISM_TRANSITION':
        //        this.walkChildren(f)
        //        break;
        case 'EVENT_CONTEXT':
          f.name = 'Composition context';
          this.walkCompositionContext(f);
          break;
        case 'CODE_PHRASE':
          f.name = f.id;
          this.walkElement(f, false);
          break;
        case 'PARTY_PROXY':
          f.name = f.id;
          this.walkElement(f, false);
          break;
        default:
          this.walkUnsupported(f)
          break;
      }
    }
  }

  private walkUnsupported(f: FormElement)
  {
    formatUnsupported(this,f);
  }

  private walkCluster(f: FormElement) {
    formatCluster(this, f)
    this.walkChildren(f);
  }

  private walkEvent(f: FormElement) {
    formatObservationEvent(this, f)
    this.walkChildren(f);
  }

  private walkComposition(f: FormElement) {
    formatCompositionHeader(this, f)
    formatNodeHeader(this, f);
    this.walkRmChildren(f);
    formatNodeFooter(this,f);
    this.walkNonRMChildren(f)
  }


  private walkSection(f: FormElement) {
    if (!this.config?.skippedAQLPaths?.includes(f.aqlPath)) {
      formatLeafHeader(this, f)
    }
    this.walkChildren(f)
  }


  private walkEntry(f: FormElement) {

    formatLeafHeader(this, f)
    formatNodeHeader(this, f)
    this.walkRmChildren(f);
    this.walkNonRMChildren(f)
    formatNodeFooter(this,f)

  }

  private walkCompositionContext(f: FormElement) {

    formatCompositionContextHeader(this, f);
    if (f.children?.length > 0) {
      formatNodeHeader(this, f)
      this.walkChildren(f)
      formatNodeFooter(this,f)
    }
  }

  private walkRmChildren(f: FormElement) {

    const rmAttributes = new Array<FormElement>();

    if (f.children) {
      f.children.forEach((child) => {
        if (!child?.inContext) return

        if (['ism_transition'].includes(child.id)) {
          if (child.children) {
            child.children.forEach((ismChild) => {
              this.stripExcludedRmTypes(ismChild, rmAttributes);
            });
          }
        } else {
          this.stripExcludedRmTypes(child, rmAttributes);
        }
      });
    }

    if (rmAttributes.length === 0) return

    rmAttributes.forEach(child => {
      child.localizedName = child.id;
      this.walk(child);
    });

  }

  private stripExcludedRmTypes(childNode: FormElement, list: FormElement[]) {

    if (!this.config.excludedRMTags.includes(childNode.id)) {
      list.push(childNode);
    }
  }

  // Look for display participations flag in Annotations
//    const displayParticipations= () => {
//      if (f.annotations)
//        console.dir(f.annotations)

  //     for (const key in f.annotations) {
  //       if (f.annotations.hasOwnProperty(key) && key.valueOf() === 'comment')
  //       return true
  //    }
  //     return false
  //   }

  /*
    private walkParticipations() {

      if (this.config.hideParticipations) return;

      this.sb.append(`===== _Participations_ [0..*]`);
      this.sb.append('[options="header", cols="25,5,55,30"]');
      this.sb.append('|====');
      this.sb.append('|NodeId|Attr.|RM Type| Name | Details');
      this.sb.append('|RM: function|1..1|DV_TEXT| Role | The function of the Party in this participation');
      this.sb.append('')
  //      this.sb.append('|RM: mode|0..1|DV_CODED_TEXT| Mode | Optional field for recording the \'mode\' of the performer / activity interaction, e.g. present, by telephone, by email etc.');
      this.sb.append('|RM: performer|1..1|PARTY_IDENTIFIED| Performer name and ID | The id and possibly demographic system link of the party participating in the activity.');
  //      this.sb.append('|RM: time|0..1|DV_INTERVAL| Time | The time interval during which the participation took place, ');
      this.sb.append('|====');

    }
  */

  private walkElement(f: FormElement, isChoice: boolean) {
    formatNodeContent(this, f, isChoice)
    this.walkDataType(f)
    formatAnnotations(this,f);
  }

  private walkDataType(f: FormElement) {

    const adjustRmTypeForInterval  = () => {
      if (f.rmType.startsWith('DV_INTERVAL'))
        return f.rmType.replace(/(^.*<|>.*$)/g, '')
      else
      return f.rmType
    }

    const adjustedRmType = adjustRmTypeForInterval();

    switch (adjustedRmType){
      case 'ELEMENT':
        this.walkDvChoice(f)
        break
      case 'DV_CODED_TEXT':
        formatDvCodedText(this,f)
        break;
      case 'DV_TEXT':
        formatDvText(this,f)
        break;
      case 'DV_ORDINAL':
        formatDvOrdinal(this,f)
        break;
      case 'DV_SCALE':
        formatDvOrdinal(this,f);
        break;
      case 'DV_QUANTITY':
        formatDvQuantity(this,f);
        break;
      case 'DV_COUNT':
        formatDvCount(this,f);
        break;
      default:
        formatDvDefault(this,f);
    }
  }



  private getValueOfRecord(record?: Record<string, string>): string {
    if (record) {
      return record[this.defaultLang];
    } else {
      return '';
    }
  }

  public getDescription = (f: FormElement) => {
    const language: string = 'en'
    if (!f.inContext)
      return this.getValueOfRecord(f.localizedDescriptions)
    else
      return rmDescriptions[f.id] ? rmDescriptions[f.id][language] : ''
  };

  private walkDvChoice(f: FormElement) {
    this.walkElement(f, false)

    if (isAnyChoice(f.children.map(child => child.rmType)))
      return

    this.sb.append(`|_SubTypes_ | |`)
    f.children.forEach((child) => {
      child.parentNode = f
      this.walkElement(child, true)
    });
  }


}
