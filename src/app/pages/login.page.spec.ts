import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPage } from './login.page';
import { CustomerAuthService } from '../services/customer-auth.service';

type Stub = {
  signIn: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  user: () => unknown;
  navigate: ReturnType<typeof vi.fn>;
};

let stub: Stub;

class CustomerAuthStub {
  signIn = stub.signIn;
  signUp = stub.signUp;
  user = () => stub.user();
}

describe('LoginPage', () => {
  beforeEach(() => {
    stub = {
      signIn: vi.fn().mockResolvedValue('Invalid login credentials'),
      signUp: vi.fn().mockResolvedValue({ error: null, message: 'Check your email' }),
      user: () => null,
      navigate: vi.fn().mockResolvedValue(true),
    };
    TestBed.configureTestingModule({
      providers: [
        LoginPage,
        provideRouter([]),
        { provide: CustomerAuthService, useClass: CustomerAuthStub },
      ],
    });
    stub.navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  function page(): LoginPage {
    return TestBed.inject(LoginPage);
  }

  it('renders a labelled email and password field', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[name=email]')).toBeTruthy();
    expect(el.querySelector('input[name=password]')).toBeTruthy();
  });

  it('does not call the auth service when both fields are empty', async () => {
    const component = page();
    component.form.email = '';
    component.form.password = '';
    await component.submit();
    expect(stub.signIn).not.toHaveBeenCalled();
    expect(stub.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Enter your email and password to continue.');
  });

  it('does not call the auth service when the password is missing', async () => {
    const component = page();
    component.form.email = 'someone@example.com';
    component.form.password = '';
    await component.submit();
    expect(stub.signIn).not.toHaveBeenCalled();
    expect(component.error()).toBe('Enter your email and password to continue.');
  });

  it('does not call the auth service when the email is missing', async () => {
    const component = page();
    component.form.email = '   ';
    component.form.password = 'secret-password';
    await component.submit();
    expect(stub.signIn).not.toHaveBeenCalled();
    expect(component.error()).toBe('Enter your email and password to continue.');
  });

  it('requires a name when registering', async () => {
    const component = page();
    component.registerMode.set(true);
    component.form.name = '  ';
    component.form.email = 'someone@example.com';
    component.form.password = 'secret-password';
    await component.submit();
    expect(stub.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Enter your name to create an account.');
  });

  it('signs in with the trimmed email when both fields are present', async () => {
    const component = page();
    component.form.email = '  someone@example.com  ';
    component.form.password = 'secret-password';
    await component.submit();
    expect(stub.signIn).toHaveBeenCalledWith('someone@example.com', 'secret-password');
  });

  it('surfaces the auth error message', async () => {
    const component = page();
    component.form.email = 'someone@example.com';
    component.form.password = 'wrong-password';
    await component.submit();
    expect(component.error()).toBe('Invalid login credentials');
    expect(stub.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the account page on a successful sign in', async () => {
    stub.signIn.mockResolvedValue(null as unknown as string);
    const component = page();
    component.form.email = 'someone@example.com';
    component.form.password = 'secret-password';
    await component.submit();
    expect(stub.navigate).toHaveBeenCalledWith('/account');
  });

  it('does not submit a second time while a sign in is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    stub.signIn.mockImplementation(() => new Promise((r) => (release = r)));
    const component = page();
    component.form.email = 'someone@example.com';
    component.form.password = 'secret-password';
    const first = component.submit();
    await component.submit();
    expect(stub.signIn).toHaveBeenCalledTimes(1);
    release(null);
    await first;
  });

  it('clears a stale error when switching between sign in and register', () => {
    const component = page();
    component.error.set('old failure');
    component.toggleMode();
    expect(component.error()).toBe('');
  });

  it('shows the confirmation message after registering', async () => {
    const component = page();
    component.registerMode.set(true);
    component.form.name = 'Ada Lovelace';
    component.form.email = 'ada@example.com';
    component.form.password = 'secret-password';
    await component.submit();
    expect(stub.signUp).toHaveBeenCalledWith('Ada Lovelace', 'ada@example.com', 'secret-password');
    expect(component.message()).toBe('Check your email');
  });
});
