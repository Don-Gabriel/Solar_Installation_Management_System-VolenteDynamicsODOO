import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Sun,
  ArrowUpRight,
  ShieldCheck,
  PanelTop,
  HardHat,
} from "lucide-react";
import { SmartForm } from "@/components/shared";
import { api, queryClient, setCsrf } from "@/lib/api";
export function Login() {
  const login = useMutation({
    mutationFn: (body: any) =>
      api("/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      setCsrf(data.csrfToken);
      queryClient.setQueryData(["session"], data);
    },
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Sun />
          </span>
          <span>sunpower</span>
        </Link>
        <div className="login-copy">
          <span className="login-pill">Built for the people behind solar</span>
          <h1>
            Solar work,
            <br />
            clearly managed.
          </h1>
          <p>
            From the first conversation to the final connection. Keep your
            customers, crew and every solar asset moving together.
          </p>
          <figure className="login-photo">
            <img
              src="/images/solar-team.png"
              width="1536"
              height="1024"
              alt="Illustration of two solar installers checking a rooftop system"
            />
            <figcaption>
              AI-generated illustration. Not a customer installation.
            </figcaption>
          </figure>
          <div className="login-points">
            <span>
              <PanelTop />
              Projects
            </span>
            <span>
              <HardHat />
              Field teams
            </span>
            <span>
              <ShieldCheck />
              Repairs & warranty
            </span>
          </div>
        </div>
        <small>SunPower Solutions · Installation management</small>
      </section>
      <section className="login-form">
        <div>
          <span className="mobile-brand">
            <Sun /> sunpower
          </span>
          <h2>Welcome back</h2>
          <p>Sign in to your operations workspace.</p>
          <SmartForm
            fields={[
              { name: "email", label: "Email address", type: "email" },
              { name: "password", label: "Password", type: "password" },
            ]}
            defaults={{ email: "admin@sunpower.local" }}
            submit="Sign in"
            onSubmit={(v) => login.mutate(v)}
            pending={login.isPending}
            error={login.error}
          />
          <p className="login-help">
            Local demo accounts are listed in the project setup guide. Your role
            determines the workspace you see.
          </p>
          <Link to="/enquire" className="customer-link">
            Looking to install solar? Send an enquiry <ArrowUpRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
