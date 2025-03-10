import {ModalButtonOptions, ModalOptions, NzModalRef, NzModalService} from 'ng-zorro-antd/modal';
import {Injectable, Injector, Type} from '@angular/core';
import {NzSafeAny} from 'ng-zorro-antd/core/types';
import * as _ from 'lodash';
import {Observable, of} from 'rxjs';
import {first, tap} from 'rxjs/operators';
import {DragDrop} from "@angular/cdk/drag-drop";
import {fnGetUUID} from "../utils/tools";
import {DragRef} from "@angular/cdk/drag-drop/drag-ref";

type ModalZIndex = { zIndex: number, canChange: boolean };

export enum ModalBtnStatus {
  Cancel,
  Ok
}

// 组件实例需要继承此类
export abstract class BasicConfirmModalComponent {
  protected params: any; // service传给component instance的参数
  protected constructor() {
  }

  protected abstract getCurrentValue(): any;
}

@Injectable()
export class ModalWrapService {
  protected bsModalService: NzModalService;

  constructor(private baseInjector: Injector, public dragDrop: DragDrop) {
    this.bsModalService = this.baseInjector.get(NzModalService);
  }

  protected getRandomCls() {
    return `NZ-MODAL-WRAP-CLS-` + fnGetUUID();
  }

  private cancelCallback(modalButtonOptions: ModalButtonOptions): void {
    return modalButtonOptions['modalRef'].destroy({status: ModalBtnStatus.Cancel, value: null});
  }

  private confirmCallback(modalButtonOptions: ModalButtonOptions): void {
    (modalButtonOptions['modalRef'].componentInstance as any).getCurrentValue().pipe(
      tap((modalValue) => {
        if (!modalValue) {
          return of(false);
        } else {
          return modalButtonOptions['modalRef'].destroy({status: ModalBtnStatus.Ok, modalValue});
        }
      })
    ).subscribe();
  }

  getZIndex(element: HTMLElement): number {
    return +getComputedStyle(element, null).zIndex;
  }

  /**
   * 获取所有对话框最大值,并确定是否需要修改
   * @param wrapElement 待修改z-index 容器
   */
  getModalMaxZIndex(wrapElement: HTMLElement): ModalZIndex {
    return this.bsModalService.openModals.reduce<ModalZIndex>((prev, modal) => {
      // @ts-ignore
      const element = modal.containerInstance.elementRef.nativeElement;
      if (wrapElement === element) {
        return prev;
      }
      const zIndex = this.getZIndex(element);
      if (zIndex >= prev.zIndex) {
        prev.zIndex = zIndex;
        prev.canChange = true;
      }
      return prev;
    }, {zIndex: this.getZIndex(wrapElement), canChange: false!});
  }

  // 当对话框面板时,设置当前对话框z-index为最大
  protected setMaxZIndex(wrapElement: HTMLElement): void {
    wrapElement.addEventListener('mousedown', () => {
      const modalZIndex = this.getModalMaxZIndex(wrapElement);
      if (modalZIndex.canChange) {
        wrapElement.style.zIndex = modalZIndex.zIndex + 1 + '';
      }
    }, false);
  }


  protected createDrag<T = NzSafeAny>(wrapCls: string): DragRef<T> | null {
    const wrapElement = document.querySelector<HTMLDivElement>(`.${wrapCls}`)!;

    const rootElement = wrapElement.querySelector<HTMLDivElement>(`.ant-modal-content`)!;
    const handle = rootElement.querySelector<HTMLDivElement>('.ant-modal-header')!;
    const modalZIndex = this.getModalMaxZIndex(wrapElement);
    if (modalZIndex.canChange) {
      wrapElement.style.zIndex = modalZIndex.zIndex + 1 + '';
    }
    // this.fixedWrapElementStyle(wrapElement);
    this.setMaxZIndex(wrapElement);
    if (handle) {
      handle.className += ' hand-model-move';
      return this.dragDrop.createDrag(handle).withHandles([handle]).withRootElement(rootElement);
    }
    return null
  }

  protected fixedWrapElementStyle(wrapElement: HTMLElement): void {
    wrapElement.style.pointerEvents = 'none';
  }

  // 创建对话框的配置项
  createModalConfig(component: Type<any>, modalOptions: ModalOptions = {}, params: object = {}, wrapCls: string): ModalOptions {
    const defaultOptions: ModalOptions = {
      nzTitle: '',
      nzContent: component,
      nzMaskClosable: false,
      nzFooter: [{
        label: '确认',
        type: 'primary',
        show: true,
        onClick: (this.confirmCallback).bind(this)
      }, {
        label: '取消',
        type: 'default',
        show: true,
        onClick: (this.cancelCallback).bind(this)
      }],
      nzOnCancel: () => {
        return new Promise(resolve => {
          resolve({status: ModalBtnStatus.Cancel, value: null});
        });
      },
      nzClosable: true,
      nzWidth: 720,
      nzComponentParams: {
        params
      }, // 参数中的属性将传入nzContent实例中
    }
    const newOptions = _.merge(defaultOptions, modalOptions);
    newOptions.nzWrapClassName = (newOptions.nzWrapClassName || '') + ' ' + wrapCls;
    return newOptions;
  }

  show(component: Type<any>, modalOptions: ModalOptions = {}, params: object = {}): Observable<NzSafeAny> {
    const wrapCls = this.getRandomCls();
    const newOptions = this.createModalConfig(component, modalOptions, params, wrapCls);
    const modalRef = this.bsModalService.create(newOptions);
    let drag: DragRef | null;
    modalRef.afterOpen.pipe(first()).subscribe(() => {
      drag = this.createDrag(wrapCls);
    });

    return modalRef.afterClose.pipe(tap(() => {
      drag!.dispose();
      drag = null;
    }));
  }

}
