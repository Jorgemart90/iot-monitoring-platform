import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';
import { IconComponent } from './icon.component';
@Component({
  selector: 'p-login',
  imports: [FormsModule, IconComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  s = inject(PlatformService);
  master = signal(false);
  username = '';
  password = '';
  login() {
    void this.s.login(this.master(), this.username, this.password);
  }
}
