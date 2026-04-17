import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiInputDirective } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TuiTextfield, TuiInputDirective, TuiLabel],
  template: `
    <div class="space-y-1">
      <tui-textfield>
        <label tuiLabel>{{ label }}</label>
        <input tuiInput [type]="type" [formControl]="control" />
      </tui-textfield>
      <p *ngIf="hint" class="text-xs text-slate-500">{{ hint }}</p>
      <p *ngIf="error && control.invalid && (control.dirty || control.touched)" class="text-xs text-rose-600">
        {{ error }}
      </p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInputComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) control!: FormControl<unknown>;
  @Input() type: 'text' | 'password' | 'number' = 'text';
  @Input() hint = '';
  @Input() error = '';
}
