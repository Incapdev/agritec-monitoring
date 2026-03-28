import { Component } from '@angular/core';
import { Dashboard } from './components/dashboard';

@Component({
  selector: 'app-root',
  imports: [Dashboard],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
