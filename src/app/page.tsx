'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Shield, Eye, Bell, Lock, ArrowRight, Smartphone } from 'lucide-react';
import { horizontalScale, verticalScale } from '@/lib/matrix.utils';

export default function Home() {
  const deepLink = "https://radix.app.serwise.co.in";

  return (
    <main className="hero-gradient min-vh-100 pb-5">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg py-4">
        <div className="container">
          <a className="navbar-brand d-flex align-items-center gap-2" href="#">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="fw-bold fs-4 text-white">WATCHTOWER</span>
          </a>
          <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center">
              <li className="nav-item"><a className="nav-link px-3" href="#features">Features</a></li>
              <li className="nav-item"><a className="nav-link px-3" href="#about">About</a></li>
              <li className="nav-item ms-lg-3">
                <a href={deepLink} className="btn btn-accent d-flex align-items-center gap-2">
                  Launch App <Smartphone size={18} />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container text-center py-5 mt-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="display-1 fw-bold mb-4 text-gradient">
            Vigilance Perfected.
          </h1>
          <p className="lead text-muted mx-auto mb-5" style={{ maxWidth: horizontalScale(700) }}>
            Next-generation security monitoring for elite operations. Watchtower provides real-time oversight and absolute control over your digital and physical assets.
          </p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <a href={deepLink} className="btn btn-accent btn-lg px-5 py-3 d-flex align-items-center gap-2">
              Get Started <ArrowRight size={20} />
            </a>
            <button className="btn btn-outline-light btn-lg px-5 py-3 rounded-pill">
              Watch Demo
            </button>
          </div>
        </motion.div>

        {/* Hero Image / UI Placeholder */}
        <motion.div 
          className="mt-5 pt-5"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
        >
          <div className="glass-card mx-auto p-4 shadow-lg" style={{ maxWidth: horizontalScale(1000), height: verticalScale(400), background: 'rgba(255,255,255,0.02)' }}>
             <div className="w-100 h-100 d-flex align-items-center justify-content-center flex-column text-muted border border-secondary border-dashed rounded-4">
                <Shield size={64} className="mb-3 opacity-25" />
                <p>Interactive Security Dashboard Preview</p>
             </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-5 mt-5">
        <div className="row g-4">
          {[
            { icon: Eye, title: "Real-time Monitoring", desc: "Never miss a beat with live updates from all sensors and feeds." },
            { icon: Bell, title: "Instant Alerts", desc: "Advanced notification system to keep you informed of every critical event." },
            { icon: Lock, title: "End-to-End Encryption", desc: "Your security data is for your eyes only. Encrypted and safe." }
          ].map((feature, i) => (
            <div key={i} className="col-md-4">
              <motion.div 
                className="glass-card h-100 p-5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
              >
                <div className="feature-icon">
                  <feature.icon size={28} />
                </div>
                <h3 className="fw-bold mb-3">{feature.title}</h3>
                <p className="text-muted mb-0">{feature.desc}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mt-5 pt-5 border-top border-secondary border-opacity-25 text-center text-muted">
        <p>© 2026 Watchtower. All rights reserved.</p>
      </footer>
    </main>
  );
}
